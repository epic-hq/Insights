import type { LoaderFunctionArgs } from "react-router"
import { getProjectStatusData } from "~/utils/project-status.server"

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')

  if (!projectId) {
    return Response.json(
      { success: false, error: 'Project ID is required' },
      { status: 400 }
    )
  }

  try {
    const statusData = await getProjectStatusData(projectId)
    
    if (!statusData) {
      return Response.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    return Response.json({ success: true, data: statusData })
  } catch (error) {
    console.error('Error in project status API:', error)
    return Response.json(
      { success: false, error: 'Failed to fetch project status' },
      { status: 500 }
    )
  }
}