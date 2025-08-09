import type { ActionFunction, LoaderFunction } from "react-router"
import consola from "consola"
import { userContext } from "~/server/user-context"
import { currentProjectContext } from "~/server/current-project-context"
import {
  getAnnotationsForEntity,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  type EntityType,
  type AnnotationType,
} from "../db"

// GET /api/annotations - Fetch annotations for an entity
export const loader: LoaderFunction = async ({ context, request }) => {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  const accountId = ctx.account_id

  const ctx_project = context.get(currentProjectContext)
  const projectId = ctx_project.projectId

  if (!accountId || !projectId) {
    return Response.json({ error: { message: "Missing account or project context" } }, { status: 400 })
  }

  const url = new URL(request.url)
  const entityType = url.searchParams.get("entityType") as EntityType
  const entityId = url.searchParams.get("entityId")
  const annotationType = url.searchParams.get("annotationType") as AnnotationType | undefined
  const includeThreads = url.searchParams.get("includeThreads") === "true"

  if (!entityType || !entityId) {
    return Response.json({ error: { message: "Missing entityType or entityId" } }, { status: 400 })
  }

  try {
    const { data: annotations, error } = await getAnnotationsForEntity({
      supabase,
      accountId,
      projectId,
      entityType,
      entityId,
      annotationType,
      includeThreads,
    })

    if (error) {
      consola.error("Failed to fetch annotations:", error)
      return Response.json({ error: { message: "Failed to fetch annotations" } }, { status: 500 })
    }

    return Response.json({ annotations })
  } catch (error) {
    consola.error("Exception in annotations loader:", error)
    return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
  }
}

// POST /api/annotations - Handle annotation actions
export const action: ActionFunction = async ({ context, request }) => {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  const accountId = ctx.account_id
  const userId = ctx.claims?.sub

  const ctx_project = context.get(currentProjectContext)
  const projectId = ctx_project.projectId

  if (!accountId || !projectId || !userId) {
    return Response.json({ error: { message: "Missing authentication context" } }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const action = formData.get("action") as string

    switch (action) {
      case "add-comment": {
        const entityType = formData.get("entityType") as EntityType
        const entityId = formData.get("entityId") as string
        const content = formData.get("content") as string
        const parentId = formData.get("parentId") as string | undefined

        if (!entityType || !entityId || !content?.trim()) {
          return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
        }

        const { data: annotation, error } = await createAnnotation({
          supabase,
          accountId,
          projectId,
          entityType,
          entityId,
          annotationType: "comment",
          content: content.trim(),
          parentAnnotationId: parentId,
          threadRootId: parentId, // For now, use parent as thread root
        })

        if (error) {
          consola.error("Failed to create comment:", error)
          return Response.json({ error: { message: "Failed to create comment" } }, { status: 500 })
        }

        return Response.json({ annotation })
      }

      case "add-ai-suggestion": {
        const entityType = formData.get("entityType") as EntityType
        const entityId = formData.get("entityId") as string
        const content = formData.get("content") as string
        const metadataStr = formData.get("metadata") as string

        if (!entityType || !entityId || !content?.trim()) {
          return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
        }

        let metadata = {}
        try {
          if (metadataStr) {
            metadata = JSON.parse(metadataStr)
          }
        } catch (e) {
          consola.warn("Invalid metadata JSON:", metadataStr)
        }

        const { data: annotation, error } = await createAnnotation({
          supabase,
          accountId,
          projectId,
          entityType,
          entityId,
          annotationType: "ai_suggestion",
          content: content.trim(),
          metadata,
          createdByAi: true,
          aiModel: "gpt-4", // TODO: Make this configurable
        })

        if (error) {
          consola.error("Failed to create AI suggestion:", error)
          return Response.json({ error: { message: "Failed to create AI suggestion" } }, { status: 500 })
        }

        return Response.json({ annotation })
      }

      case "update-annotation": {
        const annotationId = formData.get("annotationId") as string
        const updatesStr = formData.get("updates") as string

        if (!annotationId || !updatesStr) {
          return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
        }

        let updates = {}
        try {
          updates = JSON.parse(updatesStr)
        } catch (e) {
          return Response.json({ error: { message: "Invalid updates JSON" } }, { status: 400 })
        }

        const { data: annotation, error } = await updateAnnotation({
          supabase,
          annotationId,
          updates,
        })

        if (error) {
          consola.error("Failed to update annotation:", error)
          return Response.json({ error: { message: "Failed to update annotation" } }, { status: 500 })
        }

        return Response.json({ annotation })
      }

      case "delete-annotation": {
        const annotationId = formData.get("annotationId") as string

        if (!annotationId) {
          return Response.json({ error: { message: "Missing annotation ID" } }, { status: 400 })
        }

        const { error } = await deleteAnnotation({
          supabase,
          annotationId,
        })

        if (error) {
          consola.error("Failed to delete annotation:", error)
          return Response.json({ error: { message: "Failed to delete annotation" } }, { status: 500 })
        }

        return Response.json({ success: true })
      }

      default:
        return Response.json({ error: { message: "Unknown action" } }, { status: 400 })
    }
  } catch (error) {
    consola.error("Exception in annotations action:", error)
    return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
  }
}
