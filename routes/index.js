var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');
var router = express.Router();
var alert = require('alert-node');
var moment = require('moment');

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

  // 회원가입 가입번호 입력 페이지로 이동
  router.get('/authentication', (req,res,next) =>{
    res.render('authentication', { state:'beforeLogin' });
  });

  // 회원가입 가입번호 입력 처리
  router.post('/toSignup', (req, res, next) => {
    connection.execute('select developer_SIGN_IN_NUMBER from authentication_numbers where developer_sign_in_number=\''+req.body.sign_in_number+'\'',(err, result)=>{
      if(err){
        console.error(err.message);
        return;
      }
      // 개발자 아닐 때
      if (result.rows.length === 0) {
        connection.execute('select MANAGEMENT_SIGN_IN_NUMBER from authentication_numbers where management_sign_in_number=\''+req.body.sign_in_number+'\'',(err,result)=>{
          if (result.rows.length === 0) {
            // 개발자, 경영진 둘 다 아닐 때
            alert("가입할 수 없습니다.");
            res.redirect('back');
          } else {
            // 경영진
            return res.render('signup', { state: 'beforeLogin', job: 'management' });
          }
        });
      } else {
        // 개발자
        return res.render('signup', { state: 'beforeLogin', job: 'developer' });
      }
    });
  });

  // 회원가입 처리
  router.post('/signUp', (req, res, next) => {
    connection.execute('select count(id) from (select id from management union select id from developer) where id = \'' + req.body.id + '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      if (result.rows[0][0] === 1) {
        alert('중복된 id입니다.');
        return res.render('authentication', { state: 'beforeLogin' });
      }
    });

    var query = 'insert into ' + req.body.job + ' values (';
    // 시퀀스 꼬여서 일단 임시로.
    query += (req.body.job === 'developer') ? 'developer_seq' : 'seq_client';
    query += '.nextval, \'' + req.body.id + '\', \'' + req.body.password + '\', \'' + req.body.name + '\', \'' + req.body.resident_registration_number + '\', \'' + req.body.education + '\'';
    query += (req.body.job === 'developer') ? ', to_date(\'' + req.body.joincompanydate + '\', \'yyyy-MM-dd\'), null)' : ')';
    connection.execute(query, (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert('회원가입이 완료되었습니다.');
      res.render('index', { state: 'beforeLogin' });
    });
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

      var user = {};
      // 개발자가 아닐 때
      if (result.rows.length === 0) {
        connection.execute('select * from management where ID = \'' + req.body.id + '\' and pwd = \'' + req.body.password + '\'', (err, result) => {
          if (result.rows.length === 0) {
            // 개발자, 관리자 둘 다 아닐 때
            alert("로그인 할 수 없습니다.");
            res.redirect('back');
          } else {
            // 관리자일때
            for (let i = 0; i < result.metaData.length; i++) {
              user[result.metaData[i].name] = result.rows[0][i];
            }
            user['job'] = 'management';
            req.session.user = user;
            return res.render('index', { state: 'management' });
          }
        });
      } else {
        // 개발자일때
        for (let i = 0; i < result.metaData.length; i++) {
          user[result.metaData[i].name] = result.rows[0][i];
        }
        user['job'] = 'developer';
        req.session.user = user; 
        res.render('index', { state: 'developer' });
      }
    });
  });

  // 로그아웃
  router.get('/signout', (req, res, next) => {
    delete req.session.user;
    res.redirect('/');
  });

  // 마이페이지
  router.get('/mypage', (req, res, next) => {
    user = req.session.user;
    res.render('mypage', { state: user['job'], user: user });
  });

  // 개인정보 수정 페이지로 이동
  router.get('/editProfile', (req, res, next) => {
    res.render('editProfile', { state: req.session.user.job, user: req.session.user });
  });

  // 개인정보 수정 처리
  router.put('/editProfile', (req, res, next) => {
    if (req.body.pwd.length < 6) {
      alert("6글자 이상의 새로운 비밀번호를 입력하세요.");
      return res.render('editProfile', { state: req.session.user.job })
    }
    
    let query = 'update ' + req.session.user.job + ' set id = \'' + req.body.id + '\', pwd = \'' + req.body.pwd + '\', resident_registration_number = \'' + req.body.resident_registration_number + '\', education = \'' + req.body.education + '\'';
    if (req.session.user.job === 'developer') {
      query += ', join_company_date = to_date(\'' + req.body.join_date + '\', \'yyyy-MM-dd\')';
      req.session.user.JOIN_COMPANY_DATE = req.body.join_date;
    }
    query += ' where num = ' + req.session.user.NUM + '';
    req.session.user.ID = req.body.id;
    req.session.user.PWD = req.body.pwd;
    req.session.user.RESIDENT_REGISTRATION_NUMBER = req.body.resident_registration_number;
    req.session.user.education = req.body.education;

    connection.execute(query, (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      
      alert("정보가 수정되었습니다.");
      res.render('index', { state: req.session.user.job });
    });
  });

  

  

  

  

  
  
  

  

  

  

  

});

module.exports = router;