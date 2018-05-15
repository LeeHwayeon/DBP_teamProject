var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');
var router = express.Router();
var alert = require('alert-node');

oracledb.getConnection(dbConfig, (err, connection) => {
  if (err) {
    console.error(err.message);
    return;
  }

  // 메인 페이지
  router.get('/', function(req, res, next) {
    var state = '';
    if (req.session.user === undefined) {
      state = 'beforeLogin';
    } else if (req.session.user.job === 'd') {
      state = 'developer';
    } else {
      state = 'management';
    }
    res.render('index', { state });
  });

  // 회원가입
  router.get('/signup', (req, res, next) => {
    res.render('signup', { state: 'beforeLogin' });
  });

  // 로그인 페이지로 이동
  router.get('/signin', (req, res, next) => {
    res.render('signin', { state: 'beforeLogin' });
  });

  // 로그인 처리
  router.post('/', (req, res, next) => {
    connection.execute('select * from developer where ID = \'' + req.body.id + '\' and pwd = \'' + req.body.password + '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      // 개발자가 아닐 때
      if (result.rows.length === 0) {
        connection.execute('select * from management where ID = \'' + req.body.id + '\' and pwd = \'' + req.body.password + '\'', (err, result) => {
          if (result.rows.length === 0) {
            // 개발자, 관리자 둘 다 아닐 때
            alert("없는 계정입니다.");
            // window.alert("없는 계정입니다.");
            res.redirect('back');
          } else {
            // 관리자일때
            var user = {};
            for (let i = 0; i < result.metaData.length; i++) {
              user[result.metaData[i].name] = result.rows[0][i];
              user['job'] = 'm';
            }
            req.session.user = user;
            return res.render('index', { state: 'management'});
          }
        });
      } else {
        // 개발자일때
        var user = {};
        for (let i = 0; i < result.metaData.length; i++) {
          user[result.metaData[i].name] = result.rows[0][i];
          user['job'] = 'd';
        }
        req.session.user = user;   
        return res.render('index', { state: 'developer'});
      }
    });
  });

  // 로그아웃
  router.get('/signout', (req, res, next) => {
    delete req.session.user;
    res.redirect('/');
  })

  //회원가입 가입번호 입력
  router.get('/authentication', (req, res, next) => {
    res.render('authentication', { state: 'beforeLogin' });
  });

  //프로젝트 페이지
  router.get('/projects', (req, res, next) => {
    res.render('projects', { state: 'beforeLogin' });
  });

  // 마이페이지
  router.get('/mypage', (req, res, next) => {
    if (req.session.user['job'] === 'd') {
      return res.render('mypage', {state: 'developer'});
    } else {
      return res.render('mypage', {state: 'management'});
    }
  });
});

module.exports = router;