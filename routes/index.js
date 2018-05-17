var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');
var router = express.Router();
var alert = require('alert-node');

oracledb.autoCommit = true;

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
    } else if (req.session.user.job === 'developer') {
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
    var user = {};
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
            res.redirect('back');
          } else {
            // 관리자일때
            for (let i = 0; i < result.metaData.length; i++) {
              user[result.metaData[i].name] = result.rows[0][i];
              user['job'] = 'management';
            }
            req.session.user = user;
            return res.render('index', { state: 'management'});
          }
        });
      } else {
        // 개발자일때
        for (let i = 0; i < result.metaData.length; i++) {
          user[result.metaData[i].name] = result.rows[0][i];
          user['job'] = 'developer';
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

  // 회원가입 가입번호 입력
  router.get('/authentication', (req, res, next) => {
    res.render('authentication', { state: 'beforeLogin' });
  });

  // 마이페이지
  // 정보조회
  router.get('/mypage', (req, res, next) => {
    user = req.session.user;
    return res.render('mypage', { state: user['job'], user: user});
  });

  // 고객 관리 페이지(경영진)
  router.get('/aboutClient', (req, res, next) => {
    var clients = {};
    connection.execute('select * from client', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      return res.render('aboutClient', { state: 'management', clients: result.rows });
    });
  });

  // 고객 등록 기능
  router.post('/addClient', (req, res, next) => {
    connection.execute('insert into client(num, client_name) values(seq_client.nextval, \'' + req.body.newName + '\')', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("고객이 등록되었습니다.");
      return res.render('index', { state: 'management'});
    });
  });

  // 프로젝트 등록 페이지로 이동
  router.get('/addProject', (req, res, next) => {
    connection.execute('select * from client', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      return res.render('addProject', { state: 'management', clients: result.rows });
    });
  });

  // 프로젝트 등록
  router.post('/addProject', (req, res, next) => {
    connection.execute('insert into project(num, project_name, begin_date, end_date, order_customer) values(seq_project.nextval, \'' + req.body.name + '\', to_date(\'' + req.body.begin_date + '\', \'yyyy-MM-dd\'), to_date(\'' + req.body.end_date + '\', \'yyyy-MM-dd\'), ' + req.body.client + ')', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("프로젝트가 등록되었습니다.");
      return res.render('index', { state: 'management'});
    });
  });
});

module.exports = router;