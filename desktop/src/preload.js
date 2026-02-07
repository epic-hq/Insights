// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

// Set up the SDK logger bridge between main and renderer
contextBridge.exposeInMainWorld("sdkLoggerBridge", {
  // Receive logs from main process
  onSdkLog: (callback) =>
    ipcRenderer.on("sdk-log", (_, logEntry) => callback(logEntry)),

  // Send logs from renderer to main process
  sendSdkLog: (logEntry) => ipcRenderer.send("sdk-log", logEntry),
});

contextBridge.exposeInMainWorld("electronAPI", {
  // Navigation
  navigate: (page) => ipcRenderer.send("navigate", page),

  // Auth APIs
  login: (email, password) => ipcRenderer.invoke("login", email, password),
  loginWithGoogle: () => ipcRenderer.invoke("loginWithGoogle"),
  getAuthStatus: () => ipcRenderer.invoke("getAuthStatus"),
  logout: () => ipcRenderer.invoke("logout"),
  getAccessToken: () => ipcRenderer.invoke("getAccessToken"),
  getUserContext: () => ipcRenderer.invoke("getUserContext"),
  navigateToHome: () => ipcRenderer.invoke("navigateToHome"),

  // Meetings data
  saveMeetingsData: (data) => ipcRenderer.invoke("saveMeetingsData", data),
  loadMeetingsData: () => ipcRenderer.invoke("loadMeetingsData"),
  deleteMeeting: (meetingId) => ipcRenderer.invoke("deleteMeeting", meetingId),
  generateMeetingSummary: (meetingId) =>
    ipcRenderer.invoke("generateMeetingSummary", meetingId),
  generateMeetingSummaryStreaming: (meetingId) =>
    ipcRenderer.invoke("generateMeetingSummaryStreaming", meetingId),
  startManualRecording: (meetingId) =>
    ipcRenderer.invoke("startManualRecording", meetingId),
  stopManualRecording: (recordingId) =>
    ipcRenderer.invoke("stopManualRecording", recordingId),
  debugGetHandlers: () => ipcRenderer.invoke("debugGetHandlers"),
  checkForDetectedMeeting: () => ipcRenderer.invoke("checkForDetectedMeeting"),
  joinDetectedMeeting: () => ipcRenderer.invoke("joinDetectedMeeting"),
  getActiveRecordingId: (noteId) =>
    ipcRenderer.invoke("getActiveRecordingId", noteId),

  // Event listeners
  onOpenMeetingNote: (callback) =>
    ipcRenderer.on("open-meeting-note", (_, meetingId) => callback(meetingId)),
  onRecordingCompleted: (callback) =>
    ipcRenderer.on("recording-completed", (_, meetingId) =>
      callback(meetingId),
    ),
  onTranscriptUpdated: (callback) =>
    ipcRenderer.on("transcript-updated", (_, meetingId) => callback(meetingId)),
  onSummaryGenerated: (callback) =>
    ipcRenderer.on("summary-generated", (_, meetingId) => callback(meetingId)),
  onSummaryUpdate: (callback) =>
    ipcRenderer.on("summary-update", (_, data) => callback(data)),
  onRecordingStateChange: (callback) =>
    ipcRenderer.on("recording-state-change", (_, data) => callback(data)),
  onParticipantsUpdated: (callback) =>
    ipcRenderer.on("participants-updated", (_, meetingId) =>
      callback(meetingId),
    ),
  onVideoFrame: (callback) =>
    ipcRenderer.on("video-frame", (_, data) => callback(data)),
  onMeetingDetectionStatus: (callback) =>
    ipcRenderer.on("meeting-detection-status", (_, data) => callback(data)),
  onMeetingTitleUpdated: (callback) =>
    ipcRenderer.on("meeting-title-updated", (_, data) => callback(data)),
  onEvidenceUpdated: (callback) =>
    ipcRenderer.on("evidence-updated", (_, data) => callback(data)),

  // Floating Panel APIs
  resizePanel: (size) => ipcRenderer.invoke("resizePanel", size),
  closePanel: () => ipcRenderer.invoke("closePanel"),
  minimizePanel: () => ipcRenderer.invoke("minimizePanel"),
  restorePanel: () => ipcRenderer.invoke("restorePanel"),
  toggleRecording: () => ipcRenderer.invoke("toggleRecordingFromPanel"),
  submitNote: (text) => ipcRenderer.invoke("submitNoteFromPanel", text),
  showFloatingPanel: () => ipcRenderer.invoke("showFloatingPanel"),
  hideFloatingPanel: () => ipcRenderer.invoke("hideFloatingPanel"),

  // Floating Panel Event Listeners
  onRecordingState: (callback) =>
    ipcRenderer.on("recording-state", (_, data) => callback(data)),
  onEvidence: (callback) =>
    ipcRenderer.on("evidence-update", (_, data) => callback(data)),
  onTasks: (callback) =>
    ipcRenderer.on("tasks-update", (_, data) => callback(data)),
  onTranscript: (callback) =>
    ipcRenderer.on("transcript-update", (_, data) => callback(data)),
});
