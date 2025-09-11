/**
 * Session Manager for multi-window support
 *
 * Manages unique session identifiers for different browser windows/tabs,
 * enabling independent content in each window while maintaining backward compatibility.
 */

const SESSION_PARAM_KEY = "session";
const DEFAULT_SESSION_ID = "default";

export class SessionManager {
  private static instance: SessionManager;
  private currentSessionId: string;

  private constructor() {
    this.currentSessionId = this.getOrCreateSessionId();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Check if current session is the default session
   */
  public isDefaultSession(): boolean {
    return this.currentSessionId === DEFAULT_SESSION_ID;
  }

  /**
   * Generate a session-specific storage key
   * Note: This method is now mainly for consistency,
   * actual logic moved to app_constants to avoid circular dependencies
   */
  public getSessionStorageKey(baseKey: string): string {
    if (this.isDefaultSession()) {
      return baseKey; // Backward compatibility for default session
    }
    return `${baseKey}:${this.currentSessionId}`;
  }

  /**
   * Create a new window with a new session
   */
  public openNewSession(): void {
    const newSessionId = this.generateSessionId();
    const url = new URL(window.location.href);
    url.searchParams.set(SESSION_PARAM_KEY, newSessionId);
    window.open(url.toString(), "_blank");
  }

  /**
   * Get or create session ID from URL parameters
   */
  private getOrCreateSessionId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    let sessionId = urlParams.get(SESSION_PARAM_KEY);

    if (!sessionId) {
      // If no session parameter, this is either:
      // 1. Default session (backward compatibility)
      // 2. New session that needs to be created
      const isNewSession = this.shouldCreateNewSession();

      if (isNewSession) {
        sessionId = this.generateSessionId();
        this.updateUrlWithSession(sessionId);
      } else {
        sessionId = DEFAULT_SESSION_ID;
      }
    }

    return sessionId;
  }

  /**
   * Check if we should create a new session
   * This helps distinguish between:
   * - User opening excalidraw.com directly (use default)
   * - User opening from a link that should be independent (create new)
   */
  private shouldCreateNewSession(): boolean {
    // Check if this window was opened via launchQueue (file associations)
    const referrer = document.referrer;
    const windowName = window.name;
    
    // If opened from OS file association, drag-and-drop, or as a new window, create new session
    if (!referrer || windowName.includes("_blank") || window.opener) {
      return true;
    }
    
    // Check if there's a pending file operation
    if (sessionStorage.getItem("pendingFileHandle")) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update browser URL with session parameter without page reload
   */
  private updateUrlWithSession(sessionId: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set(SESSION_PARAM_KEY, sessionId);
    window.history.replaceState({}, "", url.toString());
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();
