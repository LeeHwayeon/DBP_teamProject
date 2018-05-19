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

  // 회원가입 페이지로 이동
  router.get('/signup', (req, res, next) => {
    res.render('signup', { state: 'beforeLogin' });
  });

  // 회원가입 처리
  router.post('/signup',(req, res, next) => {
    // if(!req.body.id){
    //   alert("아이디를 입력하세요.");
    //   return('back');
    // }
    // if(req.body.id===defined){
    //   alert("이미 존재하는 아이디입니다.");
    //   return('back');
    // }
    // if(!req.body.password){
    //   alert("비밀번호를 입력하세요.");
    //   return('back');      
    // }
    // if(!req.body.name){
    //   alert("이름을 입력하세요.");
    //   return('back');
    // }
    // if(!req.body.resident_registration){
    //   alert("주민번호를 입력하세요.");
    //   return('back');
    // }
    // if(!req.body.education){
    //   alert("최종학력을 입력하세요.");
    //   return('back');     
    // }
    // if(!req.body.joincompany){
    //   alert("입사일을 입력하세요.");
    //   return('back');     
    // }
    // if(req.body.password<6){
    //   alert("비밀번호는 6자리 이상으로 만드세요.");
    //   return('back');
    // }
    if(job==='developer'){
      connection.execute('insert into developer (num,id,pwd,user_name,resident_registration_number,education,join_company_date) values (seq_developer.nextval, \'' + req.body.id + '\', \''+ req.body,password +'\',\'' +req.body.name+'\',\''+req.body.resident_registration+'\',\''+req.body.education+'\',\''+req.body.joincompany+'\')',(err, result) => {
        if(err){
          console.error(err.message);
          return;
        }
        alert('회원가입이 됐습니다. 로그인 하세요.');
        return res.render('index', {state:'beforeLogin'});
      });
    }else{
      connection.execute('insert into management (num,id,pwd,user_name,resident_registration_number,education) values (seq_management.nextval, \'' + req.body.id + '\', \''+ req.body,password +'\',\'' +req.body.name+'\',\''+req.body.resident_registration+'\',\''+req.body.education+'\')',(err, result) =>{
        if(err){
          console.error(err.message);
          return;
        }
        alert('회원가입이 됐습니다. 로그인 하세요.');
        return res.render('index', {state:'beforeLogin'});        
      });
    }
  });

  // 회원가입 가입번호 입력 페이지로 이동
  router.get('/authentication',(req,res,next) =>{
    res.render('authentication',{state:'beforeLogin'});
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

  //직원 관리 페이지(경영진)
  router.get('/aboutDeveloper', (req, res, next) => {
    var developers = {};
    connection.execute('select developer.id, developer.user_name, developer.work_experience, project.project_name, project_input.role_in_project, project_input.join_date,project_input.out_date, project_input.skill from developer, project_input, project where developer.num=project_input.developer_num and project.num=project_input.project_num',
    (err, result)=>{
      if(err){
        console.error(err.message);
        return;
      }
      return res.render('aboutDeveloper',{state:'management', developers: result.rows});      
    });
  }); 


  // 동료평가 페이지(개발자)
  router.post('/peer_evaluation',( req, res, next) => {
    //프로젝트 인풋테이블의 정보를 가져와서
    connection.execute('select * from project_input',(err, result)=> {
      //직무가 PM 이면 PM평가 테이블에 추가
      if(result.role_in_project==='PM'){
        connection.execute('insert into pm_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
          if(err){
            console.log(err.message);
            return;
          }
          alert("PM평가가 등록되었습니다.");
          return res.render('index', {state:'developer'});
        })
      }else{
        //직무가 PM이 아니면 동료평가 테이블에 추가
        connection.execute('insert into peer_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
          if(err){
            console.error(err.message);
            return;
          }
          alert("동료평가가 등록되었습니다.");
          return res.render('index',{state:'developer'});      
        });    
      }
    });
  });

});

module.exports = router;