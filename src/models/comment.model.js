import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { Like } from "./like.model.js";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
  },
  {
    timestamps: true,
  }
);

commentSchema.plugin(mongooseAggregatePaginate);

commentSchema.post("findOneAndDelete", async (comment, next) => {
  if (comment) {
    // Delete associated likes
    await Like.deleteMany({ comment: comment._id });

    // Remove this comment from its parent's replies array
    if (comment.parentComment) {
      await mongoose
        .model("Comment")
        .updateOne(
          { _id: comment.parentComment },
          { $pull: { replies: comment._id } }
        );
    }

    // Delete all replies to this comment
    if (comment.replies.length > 0) {
      await mongoose
        .model("Comment")
        .deleteMany({ _id: { $in: comment.replies } });
    }
  }
  next();
});

export const Comment = mongoose.model("Comment", commentSchema);
