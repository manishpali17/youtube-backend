import mongoose, { Schema } from "mongoose";
import { Like } from "./like.model.js";

const tweetSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

tweetSchema.post("findOneAndDelete", async (tweet, next) => {
  if (tweet) {
    await Like.deleteMany({ tweet: tweet._id });
    next();
  }
  next();
});

export const Tweet = mongoose.model("Tweet", tweetSchema);
