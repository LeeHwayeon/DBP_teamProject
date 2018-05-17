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

  // function validateForm(form, options) {
  //   var id = form.id || "";
  //   var password = form.password || "";
  //   var name = form.name || "";
  //   var resident_registration= form.resident_registration || "";
  //   var education = form.education || "";
  //   var joincompany = form.joincompany || "";

  //   id = id.trim();
  //   password = password.trim();
  //   name = name.trim();
  //   resident_registration = resident_registration.trim();    
  //   education = education.trim();
  //   joincompany = joincompany.trim();

  //   if (!id) {
  //     return 'Id is required.';
  //   }
  //   if (!name) {
  //     return 'Name is required.';
  //   }
  //   if (!resident_registration) {
  //     return 'Resident registration number is required.';
  //   }
    
  //   if (!education) {
  //     return 'Education is required.';
  //   }
  
  //   if (!joincompany) {
  //     return 'Join company date is required.';
  //   }
  
  //   if (!form.password && options.needPassword) {
  //     return 'Password is required.';
  //   }
  
  //   if (form.password !== form.password_confirmation) {
  //     return 'Passsword do not match.';
  //   }
  
  //   if (form.password.length < 6) {
  //     return 'Password must be at least 6 characters.';
  //   }
  
  //   return null;
  // }

  // // 회원가입 페이지로 이동
  // router.get('/signup', (req, res, next) => {
  //   res.render('signup', { state: 'beforeLogin' });
  // });

  // //회원가입 처리
  // router.post('/signup',(req, res, next) => {
  //   var error = validateForm(req.body, 'singup',{needPassword:true});
  //   User.findOne({id:req.body.id}, function(err, user){
  //     if(err){
  //       return next(err);
  //     }
  //     if(user){
  //       alert("이미 사용중인 아이디입니다.");
  //       return res.redirect('back');
  //     }
  //     //개발자이면 개발자 테이블에 넣는다..
  //     connection.execute("insert into developer (id,pwd,user_name,resident_registration_number,education,join_company_date) values(:id,:password,:name,:resident_registration,:education,:joincompany)",
  //     [req.body.id,req.body,password,req.body.name,req.body.resident_registration,req.body.education,req.body.joincompany]
  //     ,{autoCommit:true},function(err, result){
  //       if(err){
  //         console.error(err.message);
  //         return;
  //       }else{
  //         console.log("rows inserted:"+result.rowsAffected);
  //         return;
  //       }
  //       res.render('signin',{state : 'beforLogin'})
  //     });
  //   });
  // });

  //회원가입 가입번호 입력 페이지로 이동
  router.get('/authentication',(req,res,next) =>{
    res.render('authentication',{state:'beforeLogin'});
  });

  //회원가입 가입번호 입력 처리
  router.post('/signup', (req, res, next) => {
    connection.execute('select developer_SIGN_IN_NUMBER from authentication_numbers where developer_sign_in_number=\''+req.body.sign_in_number+'\'',(err, result)=>{
      if(err){
        console.error(err.message);
        return;
      }
      //개발자 아닐 때
      if(result.rows.length === 0){
        connection.execute('select MANAGEMENT_SIGN_IN_NUMBER from authentication_numbers where management_sign_in_number=\''+req.body.sign_in_number+'\'',(err,result)=>{
          if(result.rows.length === 0){
            //개발자, 경영진 둘 다 아닐 때
            alert("등록되지 않은 사용자입니다.");
            res.redirect('back');
          } else{
            //경영진
            var user={};
            for(let i=0; i<result.metaData[i].length; i++){
              user[result.metaData[i].management_sign_in_number]=result.rows[i];
            }
            req.session.user =user;
            return res.render('signup',{state:'beforeLogin'});
          }
        });
      }else{
        //개발자
        var user ={};
        for (let i=0; i<result.metaData.length; i++){
          user[result.metaData[i].developer_sign_in_number]=result.rows[0][i];
        }
        req.session.user=user;
        return res.render('signup',{state:'beforeLogin'});
      }
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
              user[result.metaData[i].name] = result.rows[i];
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