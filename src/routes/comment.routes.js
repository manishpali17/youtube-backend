import { Router } from "express";
import {
  addComment,
  addReplyToComment,
  deleteComment,
  deleteReply,
  getVideoComments,
  updateComment,
  updateReply,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/:videoId").get(getVideoComments).post(verifyJWT, addComment);
router
  .route("/c/:commentId")
  .delete(verifyJWT, deleteComment)
  .patch(verifyJWT, updateComment);
router.route("/r/:parentCommentId").post(verifyJWT, addReplyToComment);
router
  .route("/reply/:replyId")
  .patch(verifyJWT, updateReply)
  .delete(verifyJWT, deleteReply);

export default router;
