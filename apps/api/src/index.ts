import type { APIGatewayEvent, APIGatewayResponse, Handler } from "./types";
import { corsHeaders, notFound, error } from "./middlewares/response";

// Import handlers
import {
  listHandler,
  getByIdHandler,
  searchHandler,
  nearbyHandler,
  createHandler,
  batchHandler,
} from "./handlers/places";
import {
  createHandler as reviewCreateHandler,
  voteHandler as reviewVoteHandler,
  commentHandler as reviewCommentHandler,
  commentLikeHandler as reviewCommentLikeHandler,
  hotHandler as reviewHotHandler,
  listHandler as reviewListHandler,
  shareHandler as reviewShareHandler,
  submitNewPlaceHandler as reviewSubmitNewPlaceHandler,
  approveLocationHandler as reviewApproveLocationHandler,
  cleanupExpiredHandler as reviewCleanupExpiredHandler,
  loadCommentsHandler as reviewLoadCommentsHandler,
  detailHandler as reviewDetailHandler,
  reviewLikedCommentsHandler,
} from "./handlers/reviews";

import { handleCognitoTrigger, CognitoTriggerEvent } from "./handlers/auth";
import {
  getMeHandler,
  updateMeHandler,
  getUserByIdHandler,
  getMyPhotosHandler,
  getMyReviewsHandler,
  getMySavedHandler,
  getMyStatsHandler,
  getMyVotesHandler,
  getMyLikedCommentsHandler,
  getAvatarUploadUrlHandler,
  updateAvatarHandler,
  getBackgroundUploadUrlHandler,
  updateBackgroundHandler,
  setPasswordHandler,
} from "./handlers/users";
import {
  getUploadUrlHandler as photoGetUploadUrlHandler,
  deletePhotoHandler,
} from "./handlers/photos";
import {
  infoHandler as restaurantInfoHandler,
  similarHandler as restaurantSimilarHandler,
  commentsListHandler as restaurantCommentsListHandler,
  commentsCreateHandler as restaurantCommentsCreateHandler,
  commentsLikeHandler as restaurantCommentsLikeHandler,
  commentsReportHandler as restaurantCommentsReportHandler,
  commentsDeleteHandler as restaurantCommentsDeleteHandler,
  reviewsListHandler as restaurantReviewsListHandler,
  reviewsCreateHandler as restaurantReviewsCreateHandler,
  photosListHandler as restaurantPhotosListHandler,
  menuHandler as restaurantMenuHandler,
  saveHandler as restaurantSaveHandler,
} from "./handlers/restaurants";
import {
  statsHandler as adminStatsHandler,
  adminListPlacesHandler,
  adminGetPlaceHandler,
  adminUpdatePlaceHandler,
  adminDeletePlaceHandler,
  adminListReviewsHandler,
  adminGetReviewHandler,
  adminUpdateReviewHandler,
  adminListPendingLocationsHandler,
  adminGetLocationHandler,
  adminGetLocationReviewsHandler,
  adminUpdateLocationHandler,
  adminListUsersHandler,
  adminGetUserHandler,
  adminUpdateUserHandler,
  adminListReportsHandler,
  adminGetReportHandler,
  adminUpdateReportHandler,
  adminListActivitiesHandler,
  adminActivityStatsHandler,
  adminUserActivitiesHandler,
} from "./handlers/admin";
import { logActivityHandler, batchLogActivityHandler } from "./handlers/activities";

// Route definitions
interface RouteDefinition {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

const routes: RouteDefinition[] = [
  // Places routes
  {
    method: "GET",
    pattern: /^\/places$/,
    paramNames: [],
    handler: listHandler,
  },
  {
    method: "GET",
    pattern: /^\/places\/nearby$/,
    paramNames: [],
    handler: nearbyHandler,
  },
  {
    method: "GET",
    pattern: /^\/places\/([^/]+)$/,
    paramNames: ["id"],
    handler: getByIdHandler,
  },
  {
    method: "POST",
    pattern: /^\/places\/search$/,
    paramNames: [],
    handler: searchHandler,
  },
  {
    method: "POST",
    pattern: /^\/places$/,
    paramNames: [],
    handler: createHandler,
  },
  {
    method: "POST",
    pattern: /^\/places\/batch$/,
    paramNames: [],
    handler: batchHandler,
  },

  // Reviews routes
  {
    method: "GET",
    pattern: /^\/reviews$/,
    paramNames: [],
    handler: reviewListHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews$/,
    paramNames: [],
    handler: reviewCreateHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/vote$/,
    paramNames: [],
    handler: reviewVoteHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/comment$/,
    paramNames: [],
    handler: reviewCommentHandler,
  },
  {
    method: "GET",
    pattern: /^\/reviews\/hot$/,
    paramNames: [],
    handler: reviewHotHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/share$/,
    paramNames: [],
    handler: reviewShareHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/submit-new-place$/,
    paramNames: [],
    handler: reviewSubmitNewPlaceHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/approve-location$/,
    paramNames: [],
    handler: reviewApproveLocationHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/cleanup-expired$/,
    paramNames: [],
    handler: reviewCleanupExpiredHandler,
  },
  {
    method: "GET",
    pattern: /^\/reviews\/([^/]+)\/comments$/,
    paramNames: ["reviewId"],
    handler: reviewLoadCommentsHandler,
  },
  {
    method: "POST",
    pattern: /^\/reviews\/comments\/([^/]+)\/like$/,
    paramNames: ["commentId"],
    handler: reviewCommentLikeHandler,
  },
  {
    method: "GET",
    pattern: /^\/reviews\/([^/]+)\/liked-comments$/,
    paramNames: ["reviewId"],
    handler: reviewLikedCommentsHandler,
  },
  {
    method: "GET",
    pattern: /^\/reviews\/([^/]+)$/,
    paramNames: ["reviewId"],
    handler: reviewDetailHandler,
  },

  // Users routes
  {
    method: "GET",
    pattern: /^\/users\/me$/,
    paramNames: [],
    handler: getMeHandler,
  },
  {
    method: "PUT",
    pattern: /^\/users\/me$/,
    paramNames: [],
    handler: updateMeHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/photos$/,
    paramNames: [],
    handler: getMyPhotosHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/reviews$/,
    paramNames: [],
    handler: getMyReviewsHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/saved$/,
    paramNames: [],
    handler: getMySavedHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/stats$/,
    paramNames: [],
    handler: getMyStatsHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/votes$/,
    paramNames: [],
    handler: getMyVotesHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/me\/liked-comments$/,
    paramNames: [],
    handler: getMyLikedCommentsHandler,
  },
  {
    method: "POST",
    pattern: /^\/users\/me\/avatar$/,
    paramNames: [],
    handler: getAvatarUploadUrlHandler,
  },
  {
    method: "PUT",
    pattern: /^\/users\/me\/avatar$/,
    paramNames: [],
    handler: updateAvatarHandler,
  },
  {
    method: "POST",
    pattern: /^\/users\/me\/background$/,
    paramNames: [],
    handler: getBackgroundUploadUrlHandler,
  },
  {
    method: "PUT",
    pattern: /^\/users\/me\/background$/,
    paramNames: [],
    handler: updateBackgroundHandler,
  },
  {
    method: "POST",
    pattern: /^\/users\/me\/set-password$/,
    paramNames: [],
    handler: setPasswordHandler,
  },
  {
    method: "GET",
    pattern: /^\/users\/([^/]+)$/,
    paramNames: ["id"],
    handler: getUserByIdHandler,
  },

  // Photos routes
  {
    method: "POST",
    pattern: /^\/photos\/upload-url$/,
    paramNames: [],
    handler: photoGetUploadUrlHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/photos\/([^/]+)$/,
    paramNames: ["id"],
    handler: deletePhotoHandler,
  },

  // Restaurants routes
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/info$/,
    paramNames: ["slug"],
    handler: restaurantInfoHandler,
  },
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/similar$/,
    paramNames: ["slug"],
    handler: restaurantSimilarHandler,
  },
  // Comments routes
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/comments$/,
    paramNames: ["slug"],
    handler: restaurantCommentsListHandler,
  },
  {
    method: "POST",
    pattern: /^\/restaurants\/comments$/,
    paramNames: [],
    handler: restaurantCommentsCreateHandler,
  },
  {
    method: "POST",
    pattern: /^\/restaurants\/comments\/([^/]+)\/like$/,
    paramNames: ["commentId"],
    handler: restaurantCommentsLikeHandler,
  },
  {
    method: "POST",
    pattern: /^\/restaurants\/comments\/([^/]+)\/report$/,
    paramNames: ["commentId"],
    handler: restaurantCommentsReportHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/restaurants\/comments\/([^/]+)$/,
    paramNames: ["commentId"],
    handler: restaurantCommentsDeleteHandler,
  },
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/reviews$/,
    paramNames: ["slug"],
    handler: restaurantReviewsListHandler,
  },
  {
    method: "POST",
    pattern: /^\/restaurants\/([^/]+)\/reviews$/,
    paramNames: ["slug"],
    handler: restaurantReviewsCreateHandler,
  },
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/photos$/,
    paramNames: ["slug"],
    handler: restaurantPhotosListHandler,
  },
  {
    method: "GET",
    pattern: /^\/restaurants\/([^/]+)\/menu$/,
    paramNames: ["slug"],
    handler: restaurantMenuHandler,
  },
  {
    method: "POST",
    pattern: /^\/restaurants\/([^/]+)\/save$/,
    paramNames: ["id"],
    handler: restaurantSaveHandler,
  },

  // Admin routes
  {
    method: "GET",
    pattern: /^\/admin\/stats$/,
    paramNames: [],
    handler: adminStatsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/places$/,
    paramNames: [],
    handler: adminListPlacesHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/places\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminGetPlaceHandler,
  },
  {
    method: "PATCH",
    pattern: /^\/admin\/places\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminUpdatePlaceHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/admin\/places\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminDeletePlaceHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/reviews$/,
    paramNames: [],
    handler: adminListReviewsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/reviews\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminGetReviewHandler,
  },
  {
    method: "PATCH",
    pattern: /^\/admin\/reviews\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminUpdateReviewHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/locations\/pending$/,
    paramNames: [],
    handler: adminListPendingLocationsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/locations\/([^/]+)\/reviews$/,
    paramNames: ["id"],
    handler: adminGetLocationReviewsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/locations\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminGetLocationHandler,
  },
  {
    method: "PATCH",
    pattern: /^\/admin\/locations\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminUpdateLocationHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/users$/,
    paramNames: [],
    handler: adminListUsersHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/users\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminGetUserHandler,
  },
  {
    method: "PATCH",
    pattern: /^\/admin\/users\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminUpdateUserHandler,
  },
  // Admin Reports routes
  {
    method: "GET",
    pattern: /^\/admin\/reports$/,
    paramNames: [],
    handler: adminListReportsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/reports\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminGetReportHandler,
  },
  {
    method: "PATCH",
    pattern: /^\/admin\/reports\/([^/]+)$/,
    paramNames: ["id"],
    handler: adminUpdateReportHandler,
  },
  // Admin Activities routes
  {
    method: "GET",
    pattern: /^\/admin\/activities$/,
    paramNames: [],
    handler: adminListActivitiesHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/activities\/stats$/,
    paramNames: [],
    handler: adminActivityStatsHandler,
  },
  {
    method: "GET",
    pattern: /^\/admin\/activities\/user\/([^/]+)$/,
    paramNames: ["userId"],
    handler: adminUserActivitiesHandler,
  },
  // Public Activities routes (for web tracking)
  {
    method: "POST",
    pattern: /^\/activities$/,
    paramNames: [],
    handler: logActivityHandler,
  },
  {
    method: "POST",
    pattern: /^\/activities\/batch$/,
    paramNames: [],
    handler: batchLogActivityHandler,
  },
];

// Find matching route
function matchRoute(
  method: string,
  path: string
): { handler: Handler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// Check if event is from Cognito trigger
function isCognitoTriggerEvent(
  event: APIGatewayEvent | CognitoTriggerEvent
): event is CognitoTriggerEvent {
  return "triggerSource" in event && "userPoolId" in event && "request" in event;
}

// Lambda handler - handles both API Gateway and Cognito triggers
export async function handler(
  event: APIGatewayEvent | CognitoTriggerEvent
): Promise<APIGatewayResponse | CognitoTriggerEvent> {
  // Handle Cognito trigger events
  if (isCognitoTriggerEvent(event)) {
    console.log(`[Cognito] Trigger: ${event.triggerSource}`);
    return await handleCognitoTrigger(event);
  }

  // Handle API Gateway events
  const httpMethod =
    (event as APIGatewayEvent).httpMethod ||
    (event as APIGatewayEvent).requestContext?.http?.method ||
    "GET";
  const path =
    (event as APIGatewayEvent).path ||
    (event as APIGatewayEvent).rawPath ||
    (event as APIGatewayEvent).requestContext?.http?.path ||
    "/";

  console.log(`[API] ${httpMethod} ${path}`);

  // Handle CORS preflight
  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // Find matching route
    const matched = matchRoute(httpMethod, path);

    if (!matched) {
      console.log(`[API] Route not found: ${httpMethod} ${path}`);
      return notFound(`Route not found: ${httpMethod} ${path}`);
    }

    // Add path parameters to event
    event.pathParameters = { ...event.pathParameters, ...matched.params };

    // Execute handler
    return await matched.handler.handle(event);
  } catch (err) {
    console.error("[API] Unhandled error:", err);
    return error((err as Error).message || "Internal server error", 500);
  }
}

// Export for Lambda
export { handler as lambdaHandler };
