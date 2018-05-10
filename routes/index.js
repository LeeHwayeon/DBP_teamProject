var express = require('express');
var router = express.Router();

// 메인 페이지
router.get('/', function(req, res, next) {
  res.render('index', { state: 'beforeLogin' });
});

// 회원가입
router.get('/signup', function(req, res, next) {
  res.render('signup', { state: 'beforeLogin' });
});

// 로그인
router.get('/signin', function(req, res, next) {
  res.render('signin', { state: 'beforeLogin' });
});

module.exports = router;
