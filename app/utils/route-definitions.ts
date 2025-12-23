/**
 * Single source of truth for all route definitions
 * Used by both client-side hooks and server-side utilities
 */

import { PATHS } from "~/paths";

function extractAccountId(projectPath: string): string {
  const match = projectPath.match(/^\/a\/([^/]+)/);
  return match ? match[1] : "";
}

export interface RouteDefinitions {
  home: () => string;
  login: () => string;
  register: () => string;

  // Dashboard
  dashboard: () => string;
  help: () => string;
  docs: () => string;
  accountHome: () => string;

  // Interviews
  interviews: {
    index: () => string;
    upload: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
    realtime: (id: string) => string;
    quick: () => string;
  };

  // Evidence
  evidence: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
  };

  // Themes
  themes: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
  };

  // Insights
  insights: {
    index: () => string;
    quick: () => string;
    table: () => string;
    cards: () => string;
    map: () => string;
    autoInsights: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
    withSort: (sort: string) => string;
  };

  // People
  people: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
  };

  // Facets
  facets: () => string;

  // Lenses
  lenses: {
    library: () => string;
    salesBant: () => string;
    customerDiscovery: () => string;
    consultingProject: () => string;
    /** Generic lens view for any template_key (including custom lenses) */
    byTemplateKey: (templateKey: string) => string;
  };
  /** @deprecated - use lenses.library() instead */
  lensLibrary: () => string;
  // Product Lens
  productLens: () => string;
  // BANT Lens (legacy)
  bantLens: () => string;
  personas: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
    interview: (personaId: string, interviewId: string) => string;
  };

  // Opportunities
  opportunities: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
  };

  // Priorities / roadmap tasks
  priorities: () => string;
  tasks: {
    index: () => string;
    new: () => string; // Opens modal via ?new=true query param
    detail: (id: string) => string;
  };

  // Organizations
  organizations: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
  };

  // Segments
  segments: {
    index: () => string;
    detail: (id: string) => string;
  };

  // Assets (imported files, tables, etc.)
  assets: {
    detail: (id: string) => string;
  };

  // Questions
  questions: {
    index: () => string;
    new: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
    researchWorkflow: () => string;
  };

  // Teams
  team: {
    members: () => string;
  };

  // Projects (note: these are at account level, not project level)
  projects: {
    index: () => string;
    new: () => string;
    setup: () => string;
    projectChat: () => string;
    detail: (id: string) => string;
    edit: (id: string) => string;
    dashboard: () => string;
  };

  // Sales
  salesBase: () => string;

  // Authentication
  auth: {
    login: () => string;
    register: () => string;
    loginSuccess: () => string;
    callback: () => string;
    signout: () => string;
  };

  // API routes
  api: {
    uploadFile: () => string;
    uploadFromUrl: () => string;
    generatePersonaInsights: () => string;
    interviewStatus: () => string;
    realtimeStart: () => string;
    generatePersonas: () => string;
    insightsUpdateField: () => string;
    // Annotations API routes (project-scoped)
    annotations: () => string;
    votes: () => string;
    entityFlags: () => string;
    chat: {
      projectStatus: () => string;
      interview: (interviewId: string) => string;
    };
  };
}

/**
 * Creates route definitions for a given project path
 * @param projectPath - Format: /a/:accountId/:projectId
 */
export function createRouteDefinitions(projectPath = ""): RouteDefinitions {
  const base = projectPath;

  return {
    // Marketing
    home: () => PATHS.HOME,
    login: () => PATHS.AUTH.LOGIN,
    register: () => PATHS.AUTH.REGISTER,

    // Dashboard (project root is now dashboard-v3)
    dashboard: () => base || "/",
    help: () => PATHS.HELP,
    docs: () => PATHS.DOCS,
    accountHome: () => `${base.replace(/\/[^/]+$/, "")}/home`,

    // Interviews
    interviews: {
      index: () => `${base}/interviews`,
      upload: () => `${base}/interviews/upload`,
      new: () => `${base}/interviews/new`,
      detail: (id: string) => `${base}/interviews/${id}`,
      edit: (id: string) => `${base}/interviews/${id}/edit`,
      realtime: (id: string) => `${base}/interviews/${id}/realtime`,
      // Quick route deprecated; redirect helper to index to avoid 404
      quick: () => `${base}/interviews`,
    },

    // Evidence
    evidence: {
      index: () => `${base}/evidence`,
      new: () => `${base}/evidence/new`,
      detail: (id: string) => `${base}/evidence/${id}`,
      edit: (id: string) => `${base}/evidence/${id}/edit`,
    },

    // Themes (DEPRECATED: redirects to insights routes - themes and insights are now unified)
    themes: {
      index: () => `${base}/insights`,
      new: () => `${base}/insights/new`,
      detail: (id: string) => `${base}/insights/${id}`,
      edit: (id: string) => `${base}/insights/${id}/edit`,
    },

    // Insights
    insights: {
      index: () => `${base}/insights`,
      // Quick route removed; keep helper as alias to cards to avoid broken callers
      quick: () => `${base}/insights/cards`,
      table: () => `${base}/insights/table`,
      cards: () => `${base}/insights/cards`,
      map: () => `${base}/insights/map`,
      autoInsights: () => `${base}/insights/auto-insights`,
      new: () => `${base}/insights/new`,
      detail: (insightId: string) => `${base}/insights/${insightId}`,
      edit: (insightId: string) => `${base}/insights/${insightId}/edit`,
      // Query parameter helpers
      withSort: (sort: string) => `${base}/insights?sort=${sort}`,
    },

    // People
    people: {
      index: () => `${base}/people`,
      new: () => `${base}/people/new`,
      detail: (id: string) => `${base}/people/${id}`,
      edit: (id: string) => `${base}/people/${id}/edit`,
    },

    // Facets
    facets: () => `${base}/facets`,

    // Lenses
    lenses: {
      library: () => `${base}/lenses`,
      salesBant: () => `${base}/lenses/sales-bant`,
      customerDiscovery: () => `${base}/lenses/customer-discovery`,
      consultingProject: () => `${base}/lenses/consulting-project`,
      byTemplateKey: (templateKey: string) => `${base}/lenses/${templateKey}`,
    },
    // @deprecated - use lenses.library() instead
    lensLibrary: () => `${base}/lenses`,
    // Product Lens
    productLens: () => `${base}/product-lens`,
    // BANT Lens (legacy)
    bantLens: () => `${base}/bant-lens`,
    personas: {
      index: () => `${base}/personas`,
      new: () => `${base}/personas/new`,
      detail: (id: string) => `${base}/personas/${id}`,
      edit: (id: string) => `${base}/personas/${id}/edit`,
      interview: (personaId: string, interviewId: string) =>
        `${base}/personas/${personaId}/interviews/${interviewId}`,
    },

    // Opportunities
    opportunities: {
      index: () => `${base}/opportunities`,
      new: () => `${base}/opportunities/new`,
      detail: (id: string) => `${base}/opportunities/${id}`,
      edit: (id: string) => `${base}/opportunities/${id}/edit`,
    },

    // Priorities / task system
    priorities: () => `${base}/priorities`,
    tasks: {
      index: () => `${base}/priorities`,
      new: () => `${base}/priorities/new`,
      detail: (id: string) => `${base}/priorities/${id}`,
    },

    organizations: {
      index: () => `${base}/organizations`,
      new: () => `${base}/organizations/new`,
      detail: (id: string) => `${base}/organizations/${id}`,
      edit: (id: string) => `${base}/organizations/${id}/edit`,
    },

    // Segments
    segments: {
      index: () => `${base}/segments`,
      detail: (id: string) => `${base}/segments/${id}`,
    },

    // Assets (imported files, tables, etc.)
    assets: {
      detail: (id: string) => `${base}/assets/${id}`,
    },

    // Questions
    questions: {
      index: () => `${base}/questions`,
      new: () => `${base}/questions/new`,
      detail: (id: string) => `${base}/questions/${id}`,
      edit: (id: string) => `${base}/questions/${id}/edit`,
      researchWorkflow: () => `${base}/research-workflow`,
    },

    // Teams
    team: {
      members: () => `/a/${extractAccountId(projectPath)}/team/manage`,
    },

    // Projects (note: these are at account level, not project level)
    projects: {
      index: () => `/a/${extractAccountId(projectPath)}/projects`,
      new: () => `/a/${extractAccountId(projectPath)}/projects/new`,
      // Setup should be project-scoped; keep within current `${base}` context
      setup: () => `${base}/setup`,
      projectChat: () => `${base}/project-chat`,
      detail: (id: string) => `/a/${extractAccountId(projectPath)}/${id}`,
      // Deprecated old edit path; point to project-scoped settings
      edit: (_id: string) => `${projectPath}/settings`,
      dashboard: () => base || "/",
    },

    // Sales
    salesBase: () => base,

    // Authentication
    auth: {
      login: () => "/login",
      register: () => "/register",
      loginSuccess: () => "/login_success",
      callback: () => "/auth/callback",
      signout: () => "/auth/signout",
    },

    // API routes
    api: {
      uploadFile: () => "/api/upload-file",
      uploadFromUrl: () => "/api/upload-from-url",
      generatePersonaInsights: () => "/api/generate-persona-insights",
      interviewStatus: () => "/api/interview-status",
      realtimeStart: () => `${base}/api/interviews/realtime-start`,
      generatePersonas: () => `${base}/personas/api/generate-personas`,
      insightsUpdateField: () => `${base}/insights/api/update-field`,
      chat: {
        projectStatus: () => `${base}/api/chat/project-status`,
        interview: (interviewId: string) =>
          `${base}/api/chat/interview/${interviewId}`,
      },
      // Annotations API routes (project-scoped)
      annotations: () => `${base}/api/annotations`,
      votes: () => `${base}/api/votes`,
      entityFlags: () => `${base}/api/entity-flags`,
    },
  };
}
