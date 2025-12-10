import { apiClient } from "./axios";

type ActivityType =
  | "login"
  | "logout"
  | "register"
  | "view_place"
  | "view_review"
  | "view_profile"
  | "search"
  | "search_nearby"
  | "create_review"
  | "edit_review"
  | "delete_review"
  | "create_comment"
  | "edit_comment"
  | "delete_comment"
  | "like"
  | "unlike"
  | "report"
  | "share"
  | "upload_photo"
  | "delete_photo"
  | "follow"
  | "unfollow"
  | "update_profile"
  | "update_avatar"
  | "page_view"
  | "other";

interface Activity {
  activity_type: ActivityType;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
}

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem("activity_session_id");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("activity_session_id", sessionId);
  }
  return sessionId;
}

// Queue for batching activities
let activityQueue: Activity[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 20;

// Flush the activity queue to the server
async function flushQueue() {
  if (activityQueue.length === 0) return;

  const activitiesToSend = [...activityQueue];
  activityQueue = [];

  try {
    await apiClient.post("/activities/batch", {
      activities: activitiesToSend.map((a) => ({
        ...a,
        session_id: getSessionId(),
        page_url: a.page_url || window.location.href,
        referrer: a.referrer || document.referrer,
      })),
    });
  } catch (error) {
    console.warn("[ActivityTracker] Failed to send activities:", error);
    // Re-add to queue on failure (up to a limit)
    if (activityQueue.length < MAX_QUEUE_SIZE) {
      activityQueue.push(...activitiesToSend.slice(0, MAX_QUEUE_SIZE - activityQueue.length));
    }
  }
}

// Schedule a flush
function scheduleFlush() {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushQueue();
  }, FLUSH_INTERVAL);
}

/**
 * Track a user activity
 * Activities are batched and sent every 5 seconds
 */
export function trackActivity(
  activityType: ActivityType,
  options?: {
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const activity: Activity = {
    activity_type: activityType,
    target_type: options?.targetType,
    target_id: options?.targetId,
    metadata: options?.metadata,
    page_url: window.location.href,
    referrer: document.referrer,
  };

  activityQueue.push(activity);

  // Flush immediately if queue is full
  if (activityQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Track a user activity immediately (not batched)
 * Use for important events like login/logout
 */
export async function trackActivityImmediate(
  activityType: ActivityType,
  options?: {
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await apiClient.post("/activities", {
      activity_type: activityType,
      target_type: options?.targetType,
      target_id: options?.targetId,
      metadata: options?.metadata,
      session_id: getSessionId(),
      page_url: window.location.href,
      referrer: document.referrer,
    });
  } catch (error) {
    console.warn("[ActivityTracker] Failed to track activity:", error);
  }
}

/**
 * Track page view
 */
export function trackPageView(pageName?: string, metadata?: Record<string, unknown>) {
  trackActivity("page_view", {
    metadata: {
      page_name: pageName || document.title,
      ...metadata,
    },
  });
}

/**
 * Track search
 */
export function trackSearch(query: string, resultCount?: number) {
  trackActivity("search", {
    metadata: {
      query,
      result_count: resultCount,
    },
  });
}

/**
 * Track place view
 */
export function trackPlaceView(placeId: string, placeName?: string) {
  trackActivity("view_place", {
    targetType: "place",
    targetId: placeId,
    metadata: { place_name: placeName },
  });
}

/**
 * Track review view
 */
export function trackReviewView(reviewId: string) {
  trackActivity("view_review", {
    targetType: "review",
    targetId: reviewId,
  });
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (activityQueue.length > 0) {
      // Use sendBeacon for reliability
      const data = JSON.stringify({
        activities: activityQueue.map((a) => ({
          ...a,
          session_id: getSessionId(),
          page_url: a.page_url || window.location.href,
          referrer: a.referrer || document.referrer,
        })),
      });

      const apiUrl = import.meta.env.VITE_API_URL;
      navigator.sendBeacon(`${apiUrl}/activities/batch`, data);
    }
  });

  // Also flush on visibility change (tab switch)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushQueue();
    }
  });
}
