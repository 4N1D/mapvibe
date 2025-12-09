import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error, unauthorized } from "../../middlewares/response";
import { getUserIdFromEvent } from "../../utils/auth";

interface CreateCommentBody {
  slug: string;
  content: string;
  parent_id?: string | null;
}

interface ReportCommentBody {
  reason: "spam" | "inappropriate" | "harassment" | "misinformation" | "other";
  details?: string;
}

interface CommentReply {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  like_count: number;
  created_at: string;
  parent_id: string;
  reply_to_name: string | null;
  user_has_liked?: boolean;
}

interface CommentWithReplies {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  restaurant_id: string;
  content: string;
  like_count: number;
  created_at: string;
  replies: CommentReply[];
  user_has_liked?: boolean;
}

// GET /comments/:slug - Fetch comments list with nested replies
export const listHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;
      const userId = getUserIdFromEvent(event);

      if (!slug) {
        return badRequest("Restaurant slug is required");
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom("restaurants")
        .select(["id"])
        .where("slug", "=", slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound("Restaurant not found");
      }

      const restaurantId = restaurant.id;

      const params = event.queryStringParameters || {};
      const page = Math.max(parseInt(params.page || "1"), 1);
      const limit = Math.min(Math.max(parseInt(params.limit || "10"), 1), 100);
      const offset = (page - 1) * limit;

      // Fetch top-level comments (parent_id is null)
      const topLevelComments = await db
        .selectFrom("comments")
        .innerJoin("users", "users.id", "comments.author_id")
        .select([
          "comments.id",
          "comments.text as content",
          "comments.like_count",
          "comments.created_at",
          "users.id as author_id",
          "users.display_name as author_name",
          "users.avatar as author_avatar",
        ])
        .where("comments.restaurant_id", "=", restaurantId)
        .where("comments.status", "=", "published")
        .where("comments.parent_comment_id", "is", null)
        .orderBy("comments.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count of top-level comments
      const countResult = await db
        .selectFrom("comments")
        .select((eb) => eb.fn.count("id").as("total"))
        .where("restaurant_id", "=", restaurantId)
        .where("status", "=", "published")
        .where("parent_comment_id", "is", null)
        .executeTakeFirst();

      const total = Number(countResult?.total || 0);
      const totalPages = Math.ceil(total / limit);

      // Fetch all replies for these comments (including nested replies)
      const topLevelIds = topLevelComments.map((c) => c.id);

      const repliesMap: Map<string, CommentReply[]> = new Map();

      // Build a map of comment id -> author name for reply_to_name
      const authorNameMap: Map<string, string> = new Map();
      for (const comment of topLevelComments) {
        authorNameMap.set(comment.id, comment.author_name);
      }

      if (topLevelIds.length > 0) {
        // Fetch ALL replies for this restaurant (not just direct replies)
        // We'll filter and organize them after
        const allReplies = await db
          .selectFrom("comments")
          .innerJoin("users", "users.id", "comments.author_id")
          .select([
            "comments.id",
            "comments.text as content",
            "comments.like_count",
            "comments.created_at",
            "comments.parent_comment_id",
            "users.id as author_id",
            "users.display_name as author_name",
            "users.avatar as author_avatar",
          ])
          .where("comments.restaurant_id", "=", restaurantId)
          .where("comments.status", "=", "published")
          .where("comments.parent_comment_id", "is not", null)
          .orderBy("comments.created_at", "asc")
          .execute();

        // Build author name map for all replies
        for (const reply of allReplies) {
          authorNameMap.set(reply.id, reply.author_name);
        }

        // Build a map of comment id -> root parent id
        const parentMap: Map<string, string> = new Map();
        for (const reply of allReplies) {
          parentMap.set(reply.id, reply.parent_comment_id!);
        }

        // Find the root parent (top-level comment) for each reply
        const findRootParent = (commentId: string): string | null => {
          let currentId = commentId;
          while (parentMap.has(currentId)) {
            currentId = parentMap.get(currentId)!;
          }
          return topLevelIds.includes(currentId) ? currentId : null;
        };

        // Group all replies under their root parent (top-level comment)
        for (const reply of allReplies) {
          const rootParentId = findRootParent(reply.id);
          if (!rootParentId) continue;

          if (!repliesMap.has(rootParentId)) {
            repliesMap.set(rootParentId, []);
          }

          const directParentId = reply.parent_comment_id!;
          repliesMap.get(rootParentId)!.push({
            id: reply.id,
            author_id: reply.author_id,
            author_name: reply.author_name,
            author_avatar: reply.author_avatar,
            content: reply.content,
            like_count: reply.like_count ?? 0,
            created_at: reply.created_at?.toISOString() ?? new Date().toISOString(),
            parent_id: directParentId,
            reply_to_name: authorNameMap.get(directParentId) ?? null,
          });
        }
      }

      // Get user's liked comment IDs
      let userLikedCommentIds = new Set<string>();
      if (userId) {
        // Collect all comment IDs (top-level + replies)
        const allCommentIds = [
          ...topLevelIds,
          ...Array.from(repliesMap.values()).flat().map((r) => r.id),
        ];
        if (allCommentIds.length > 0) {
          const userLikes = await db
            .selectFrom("likes")
            .select("target_id")
            .where("user_id", "=", userId)
            .where("target_type", "=", "comment")
            .where("target_id", "in", allCommentIds)
            .execute();
          userLikedCommentIds = new Set(userLikes.map((l) => l.target_id));
        }
      }

      // Build response with nested replies and user_has_liked
      const comments: CommentWithReplies[] = topLevelComments.map((comment) => ({
        id: comment.id,
        author_id: comment.author_id,
        author_name: comment.author_name,
        author_avatar: comment.author_avatar,
        restaurant_id: restaurantId,
        content: comment.content,
        like_count: comment.like_count ?? 0,
        created_at: comment.created_at?.toISOString() ?? new Date().toISOString(),
        user_has_liked: userLikedCommentIds.has(comment.id),
        replies: (repliesMap.get(comment.id) || []).map((reply) => ({
          ...reply,
          user_has_liked: userLikedCommentIds.has(reply.id),
        })),
      }));

      return success({
        restaurant_id: restaurantId,
        total,
        page,
        limit,
        total_pages: totalPages,
        comments,
      });
    } catch (err) {
      console.error("[comments/list] Error:", err);
      return error((err as Error).message);
    }
  },
};

// POST /comments - Create comment or reply
export const createHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      let body: CreateCommentBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { slug, content, parent_id } = body;

      if (!slug) {
        return badRequest("slug is required");
      }

      if (!content || content.trim().length === 0) {
        return badRequest("content is required");
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom("restaurants")
        .select(["id"])
        .where("slug", "=", slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound("Restaurant not found");
      }

      const restaurant_id = restaurant.id;

      // Get user info
      const user = await db
        .selectFrom("users")
        .select(["id", "display_name", "avatar"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        return badRequest("User not found");
      }

      // Verify parent comment exists if provided and get parent author name
      let threadDepth = 0;
      let reply_to_name: string | null = null;
      if (parent_id) {
        const parentComment = await db
          .selectFrom("comments")
          .innerJoin("users", "users.id", "comments.author_id")
          .select(["comments.id", "comments.thread_depth", "users.display_name"])
          .where("comments.id", "=", parent_id)
          .where("comments.restaurant_id", "=", restaurant_id)
          .executeTakeFirst();

        if (!parentComment) {
          return badRequest("Invalid parent_id: comment does not exist");
        }
        threadDepth = (parentComment.thread_depth ?? 0) + 1;
        reply_to_name = parentComment.display_name;
      }

      const commentId = crypto.randomUUID();
      const now = new Date();

      // Create comment
      await db
        .insertInto("comments")
        .values({
          id: commentId,
          restaurant_id,
          author_id: userId,
          text: content,
          parent_comment_id: parent_id ?? null,
          thread_depth: threadDepth,
          like_count: 0,
          status: "published",
        })
        .execute();

      return success(
        {
          id: commentId,
          author_id: userId,
          author_name: user.display_name,
          author_avatar: user.avatar ?? null,
          restaurant_id,
          content,
          like_count: 0,
          created_at: now.toISOString(),
          parent_id: parent_id ?? null,
          reply_to_name,
        },
        201
      );
    } catch (err) {
      console.error("[comments/create] Error:", err);
      return error((err as Error).message);
    }
  },
};

// POST /comments/:commentId/like - Toggle like on comment
export const likeHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const commentId = event.pathParameters?.commentId;

      if (!userId) {
        return unauthorized("Authentication required");
      }

      if (!commentId) {
        return badRequest("Comment ID is required");
      }

      // Verify comment exists
      const comment = await db
        .selectFrom("comments")
        .select(["id", "like_count"])
        .where("id", "=", commentId)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!comment) {
        return notFound("Comment not found");
      }

      // Check if user already liked this comment
      const existingLike = await db
        .selectFrom("likes")
        .select(["id"])
        .where("target_type", "=", "comment")
        .where("target_id", "=", commentId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      let liked: boolean;
      let newLikeCount: number;

      if (existingLike) {
        // Unlike - remove the like
        await db
          .deleteFrom("likes")
          .where("target_type", "=", "comment")
          .where("target_id", "=", commentId)
          .where("user_id", "=", userId)
          .execute();

        newLikeCount = Math.max((comment.like_count ?? 0) - 1, 0);
        liked = false;
      } else {
        // Like - add the like
        await db
          .insertInto("likes")
          .values({
            user_id: userId,
            target_type: "comment",
            target_id: commentId,
          })
          .execute();

        newLikeCount = (comment.like_count ?? 0) + 1;
        liked = true;
      }

      // Update like_count on comment
      await db
        .updateTable("comments")
        .set({ like_count: newLikeCount })
        .where("id", "=", commentId)
        .execute();

      return success({
        liked,
        like_count: newLikeCount,
      });
    } catch (err) {
      console.error("[comments/like] Error:", err);
      return error((err as Error).message);
    }
  },
};

// POST /comments/:commentId/report - Report a comment
export const reportHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const commentId = event.pathParameters?.commentId;

      if (!userId) {
        return unauthorized("Authentication required");
      }

      if (!commentId) {
        return badRequest("Comment ID is required");
      }

      let body: ReportCommentBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { reason, details } = body;

      const validReasons = ["spam", "inappropriate", "harassment", "misinformation", "other"];
      if (!reason || !validReasons.includes(reason)) {
        return badRequest(
          "Valid reason is required: spam, inappropriate, harassment, misinformation, or other"
        );
      }

      // Verify comment exists
      const comment = await db
        .selectFrom("comments")
        .select(["id"])
        .where("id", "=", commentId)
        .executeTakeFirst();

      if (!comment) {
        return notFound("Comment not found");
      }

      // Check if user already reported this comment
      const existingReport = await db
        .selectFrom("reports")
        .select(["id"])
        .where("target_type", "=", "comment")
        .where("target_id", "=", commentId)
        .where("reporter_id", "=", userId)
        .executeTakeFirst();

      if (existingReport) {
        return badRequest("You have already reported this comment");
      }

      // Create report (id is auto-generated by database)
      await db
        .insertInto("reports")
        .values({
          reporter_id: userId,
          target_type: "comment",
          target_id: commentId,
          reason,
          details: details ?? null,
          status: "pending",
        })
        .execute();

      return success({
        success: true,
        message: "Báo cáo đã được ghi nhận",
      });
    } catch (err) {
      console.error("[comments/report] Error:", err);
      return error((err as Error).message);
    }
  },
};

// DELETE /comments/:commentId - Delete a comment
export const deleteHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const commentId = event.pathParameters?.commentId;

      if (!userId) {
        return unauthorized("Authentication required");
      }

      if (!commentId) {
        return badRequest("Comment ID is required");
      }

      // Verify comment exists and user is the author
      const comment = await db
        .selectFrom("comments")
        .select(["id", "author_id"])
        .where("id", "=", commentId)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!comment) {
        return notFound("Comment not found");
      }

      // Check if user is author (or could add admin check here)
      if (comment.author_id !== userId) {
        return unauthorized("You can only delete your own comments");
      }

      // Soft delete - update status
      await db
        .updateTable("comments")
        .set({ status: "deleted" })
        .where("id", "=", commentId)
        .execute();

      // Also soft delete all replies
      await db
        .updateTable("comments")
        .set({ status: "deleted" })
        .where("parent_comment_id", "=", commentId)
        .execute();

      return success({
        success: true,
      });
    } catch (err) {
      console.error("[comments/delete] Error:", err);
      return error((err as Error).message);
    }
  },
};
