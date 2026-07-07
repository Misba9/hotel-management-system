const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrnausheenadmin = onRequest({"region":"asia-south1","memory":"512MiB","concurrency":80,"minInstances":0,"maxInstances":10}, (req, res) => server.then(it => it.handle(req, res)));
  