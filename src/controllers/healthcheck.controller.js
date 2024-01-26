import { asyncHandler } from "../utils/index.js";

const healthcheck = asyncHandler(async (req, res) => {
  //a healthcheck response that simply returns the OK status as json with a message
  return res.status(200).json({ message: "ok", success: true });
});

export { healthcheck };
