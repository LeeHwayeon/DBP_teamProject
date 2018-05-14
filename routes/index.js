var express = require('express');
var router = express.Router();
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');

// 메인 페이지
router.get('/', function(req, res, next) {
  oracledb.getConnection(dbConfig, (err, connection) => {
    if (err) {
      console.error(err.message);
      return;
    }
    connection.execute("select * from users", (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log(result.rows);
      res.render('index', { state: 'beforeLogin', result: result.rows });
    });
  });
});

// 회원가입
router.get('/signup', function(req, res, next) {
  res.render('signup', { state: 'beforeLogin' });
});

// 로그인
router.get('/signin', function(req, res, next) {
  res.render('signin', { state: 'beforeLogin' });
});

//회원가입 가입번호 입력
router.get('/authentication', function(req, res, next) {
  res.render('authentication', { state: 'beforeLogin' });
});

//프로젝트 페이지
router.get('/projects', function(req, res, next) {
  res.render('projects', { state: 'beforeLogin' });
});

module.exports = router;