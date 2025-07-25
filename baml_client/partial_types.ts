/*************************************************************************************************

Welcome to Baml! To use this generated code, please run one of the following:

$ npm install @boundaryml/baml
$ yarn add @boundaryml/baml
$ pnpm add @boundaryml/baml

*************************************************************************************************/

// This file was generated by BAML: please do not edit it. Instead, edit the
// BAML files and re-generate this code using: baml-cli generate
// You can install baml-cli with:
//  $ npm install @boundaryml/baml
//
/* eslint-disable */
// tslint:disable
// @ts-nocheck
// biome-ignore format: autogenerated code

import type { Image, Audio, Pdf, Video } from "@boundaryml/baml"
import type { Checked, Check } from "./types"
import type {  ActionButton,  AutoInsightsResponse,  ExecutiveInsight,  ExtractedInsight,  InterviewExtraction,  InterviewMetadata,  Interviewee,  OpportunityRecommendation,  PersonaAnalysis,  Set,  SetRecord } from "./types"
import type * as types from "./types"

/******************************************************************************
*
*  These types are used for streaming, for when an instance of a type
*  is still being built up and any of its fields is not yet fully available.
*
******************************************************************************/

export interface StreamState<T> {
  value: T
  state: "Pending" | "Incomplete" | "Complete"
}

export namespace partial_types {
    export interface ActionButton {
      label?: string | null
      action_type?: string | null
      parameters?: string | null
      priority?: string | null
    }
    export interface AutoInsightsResponse {
      executive_summary?: string | null
      top_opportunities: OpportunityRecommendation[]
      critical_insights: ExecutiveInsight[]
      persona_analysis: PersonaAnalysis[]
      competitive_considerations: string[]
      immediate_actions: ActionButton[]
      strategic_recommendations: string[]
    }
    export interface ExecutiveInsight {
      title?: string | null
      insight?: string | null
      evidence: string[]
      business_impact?: string | null
      impact_level?: string | null
      confidence_level?: string | null
      personas_affected: string[]
      recommended_actions: ActionButton[]
      category?: string | null
    }
    export interface ExtractedInsight {
      name?: string | null
      details?: string | null
      pain?: string | null
      desiredOutcome?: string | null
      evidence?: string | null
      emotionalResponse?: string | null
      underlyingMotivation?: string | null
      category?: string | null
      journeyStage?: string | null
      impact?: number | null
      novelty?: number | null
      jtbd?: string | null
      confidence?: number | null
      contradictions?: string | null
      relatedTags: string[]
      createdAt?: string | null
      [key: string]: any;
    }
    export interface InterviewExtraction {
      metadata?: InterviewMetadata | null
      interviewee?: Interviewee | null
      insights: ExtractedInsight[]
      observationsAndNotes?: string | null
      highImpactThemes: string[]
      openQuestionsAndNextSteps?: string | null
    }
    export interface InterviewMetadata {
      title?: string | null
      date?: string | null
      interviewer?: string | null
      durationMin?: number | null
    }
    export interface Interviewee {
      name?: string | null
      persona?: string | null
      participantDescription?: string | null
      segment?: string | null
      contactInfo?: string | null
    }
    export interface OpportunityRecommendation {
      title?: string | null
      description?: string | null
      revenue_potential?: string | null
      effort_estimate?: string | null
      target_personas: string[]
      supporting_insights: string[]
      competitive_advantage?: string | null
      recommended_actions: ActionButton[]
    }
    export interface PersonaAnalysis {
      persona_name?: string | null
      key_pain_points: string[]
      unmet_needs: string[]
      revenue_potential?: string | null
      willingness_to_pay?: string | null
      recommended_solutions: string[]
      competitive_threats: string[]
    }
    export interface Set {
      name?: string | null
      description?: string | null
      members: SetRecord[]
    }
    export interface SetRecord {
      term?: string | null
      definition?: string | null
    }
}