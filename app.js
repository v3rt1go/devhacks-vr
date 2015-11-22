'use strict';

var express = require('express'),
  app       = express(),
  request   = require('request'),
  path      = require('path'),
  bluemix   = require('./config/bluemix'),
  validator = require('validator'),
  watson    = require('watson-developer-cloud'),
  extend    = require('util')._extend,
  fs        = require('fs'),
  multer    = require('multer');

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

var upload = multer({ storage: storage });

require('./config/express')(app);

var credentials = extend({
  version: 'v1',
  username: 'b85f7be5-741f-4773-8caa-5470e0ee2b1a',
  password: 'DYNHBE59fqhG'
}, bluemix.getServiceCreds('visual_recognition')); // VCAP_SERVICES

// Create the service wrapper
var visualRecognition = watson.visual_recognition(credentials);

app.post('/', upload.single('image'), function(req, res, next) {

  // Classifiers are 0 = all or a json = {label_groups:['<classifier-name>']}
  var classifier = req.body.classifier || '0';  // All
  if (classifier !== '0') {
    classifier = JSON.stringify({label_groups:[classifier]});
  }

  var imgFile;
  console.log(req.file);
  console.log(req.body);

  if (req.file) {
    // file image
    imgFile = fs.createReadStream(req.file.path);
  } else if(req.body.url && validator.isURL(req.body.url)) {
    // web image
    imgFile = request(req.body.url.split('?')[0]);
  } else if (req.body.url && req.body.url.indexOf('images') === 0) {
    // local image
    imgFile = fs.createReadStream(path.join('public', req.body.url));
  } else {
    // malformed url
    return next({ error: 'Malformed URL', code: 400 });
  }

  var formData = {
    labels_to_check: classifier,
    image_file: imgFile
  };

  visualRecognition.recognize(formData, function(err, result) {
    // delete the recognized file
    if(req.file)
      fs.unlink(imgFile.path);

    if (err)
      next(err);
    else
      return res.json(result);
  });
});

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3003;
app.listen(port);
console.log('listening at:', port);
