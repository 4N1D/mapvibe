import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error } from "../../middlewares/response";

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
}

interface CommentWithReplies {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  review_post_id: string;
  content: string;
  like_count: number;
  created_at: string;
  replies: CommentReply[];
}

// GET /reviews/:reviewId/comments - Fetch comments list with nested replies for a review
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const reviewId = event.pathParameters?.reviewId;

      if (!reviewId) {
        return badRequest("Review ID is required");
      }

      // Verify review exists
      const review = await db
        .selectFrom("review_posts")
        .select(["id"])
        .where("id", "=", reviewId)
        .executeTakeFirst();

      if (!review) {
        return notFound("Review not found");
      }

      const params = event.queryStringParameters || {};
      const page = Math.max(parseInt(params.page || "1"), 1);
      const limit = Math.min(Math.max(parseInt(params.limit || "10"), 1), 100);
      const offset = (page - 1) * limit;

      // Fetch top-level comments (parent_comment_id is null)
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
        .where("comments.review_post_id", "=", reviewId)
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
        .where("review_post_id", "=", reviewId)
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
        // Fetch ALL replies for this review
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
          .where("comments.review_post_id", "=", reviewId)
          .where("comments.status", "=", "published")
          .where("comments.parent_comment_id", "is not", null)
          .orderBy("comments.created_at", "asc")
          .execute();

        // Build author name map for all replies
        for (const reply of allReplies) {
          authorNameMap.set(reply.id, reply.author_name);
        }

        // Build a map of comment id -> parent id
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

      // Build response with nested replies
      const comments: CommentWithReplies[] = topLevelComments.map((comment) => ({
        id: comment.id,
        author_id: comment.author_id,
        author_name: comment.author_name,
        author_avatar: comment.author_avatar,
        review_post_id: reviewId,
        content: comment.content,
        like_count: comment.like_count ?? 0,
        created_at: comment.created_at?.toISOString() ?? new Date().toISOString(),
        replies: repliesMap.get(comment.id) || [],
      }));

      return success({
        review_post_id: reviewId,
        total,
        page,
        limit,
        total_pages: totalPages,
        comments,
      });
    } catch (err) {
      console.error("[reviews/load-comments] Error:", err);
      return error((err as Error).message);
    }
  },
};
