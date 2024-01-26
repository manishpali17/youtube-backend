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
  },
  {
    timestamps: true,
  }
);

commentSchema.plugin(mongooseAggregatePaginate);

commentSchema.post("findOneAndDelete", async (comment, next) => {
  if (comment) {
    await Like.deleteMany({ comment: comment._id });
    next();
  }
  next();
});

export const Comment = mongoose.model("Comment", commentSchema);
