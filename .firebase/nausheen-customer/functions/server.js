const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrnausheencustomer = onRequest({"region":"asia-south1","memory":"512MiB","concurrency":80,"minInstances":0,"maxInstances":20}, (req, res) => server.then(it => it.handle(req, res)));
  