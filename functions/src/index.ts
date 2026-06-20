import {initializeApp} from "firebase-admin/app";
import {setGlobalOptions} from "firebase-functions";
import {
  handleSwiggyWebhook,
  handleZomatoWebhook,
  platformWebhooks,
} from "./webhooks/router.js";

initializeApp();
setGlobalOptions({maxInstances: 10});

export {handleZomatoWebhook, handleSwiggyWebhook, platformWebhooks};
