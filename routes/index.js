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

  // PM 등록 페이지로 이동 : 프로젝트 선택
  router.get('/showPrjNoPM', (req, res, next) => {
    // PM이 없는 프로젝트에 대한 정보만.
    connection.execute('select project.num, project_name, begin_date, end_date, client_name from project, client where client.num = project.order_customer minus select project.num, project_name, begin_date, end_date, client_name from client, project, project_input where client.num = project.order_customer and project.num = project_input.project_num and project_input.role_in_project = \'pm\'', (err, projects) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('showPrjNoPM', { state: 'management', projects: projects.rows });
    });
  });

  // PM 등록 페이지 : PM이 될 개발자 선택
  router.post('/appointPM', (req, res, next) => {
    if (req.body.prj === undefined) {
      alert("선택된 프로젝트가 없습니다.");
      return res.redirect("back");
    }
    connection.execute('select num, id, user_name, resident_registration_number, education, work_experience, join_company_date, skill from developer', (err, developers) => {
      if (err) {
        console.error(err.message);
        return;
      }
      connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.body.prj + '', (err, selectedPrj) => {
        if (err) {
          console.error(err.message);
          return;
        }
        var selected = '프로젝트명 : ' + selectedPrj.rows[0][1] + ', 착수일자 : ' + moment(selectedPrj.rows[0][2]).format('YYYY-MM-DD') + ', 종료일자: ' + moment(selectedPrj.rows[0][3]).format('YYYY-MM-DD') + ', 발주처 : ' + selectedPrj.rows[0][4];
        return res.render('appointDeveloper', { state: 'management', developer: developers.rows, project_num: req.body.prj, selected });
      });
      
    });
  });

  // PM 등록 페이지 : PM 등록 처리
  router.post('/addPMtable', (req, res, next) => {
    if (req.body.developer === undefined) {
      alert("PM으로 선택된 개발자가 없습니다.");
      return res.redirect("/");
    }
    if (req.body.join_date.length === 0) {
      alert("투입일을 입력하세요.");
      return res.redirect("/");
    }
    connection.execute('insert into pm(developer_num, project_num) values(' + req.body.developer + ', ' + req.body.project_num + ')', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      connection.execute('insert into project_input(project_num, developer_num, role_in_project, join_date, out_date, skill) values(' + req.body.project_num + ', ' + req.body.developer + ', ' + '\'pm\', to_date(\'' + req.body.join_date + '\', \'yyyy-MM-dd\'), null, null)', (err, result) => {
        if (err) {
          console.error(err.message);
          return;
        }
        alert("PM이 등록되었습니다.");
        return res.render('index', { state: 'management'});
      });
    });
  });

  // 프로젝트 인원 투입 페이지로 이동
  router.get('/prjInput', (req, res, next) => {
    connection.execute('select project.num, project_name, client_name from project, client where project.order_customer = client.num', (err, prj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      connection.execute('select num, id, user_name, resident_registration_number, education, work_experience, join_company_date, skill from developer', (err, dev) => {
        if (err) {
          console.error(err.message);
          return;
        }
        return res.render('prjInput', { state: 'management', projects: prj.rows, developers: dev.rows });
      });
    });
  });
  
  //- 프로젝트 인원 투입 페이지 : 역할, 합류일 선택
  router.post('/configureInput', (req, res, next) => {
    // 프로젝트 번호
    console.log(req.body.project);
    // 개발자 번호
    console.log(req.body.developer);
    // 개발자 번호 한명일 경우
    console.log(typeof req.body.developer === 'string');
    // 개발자 번호 여러명일 경우
    console.log(typeof req.body.developer === 'object');

    res.render('configureInput', { state: 'management' });
    // connection.execute('', (err, result) => {

    // });
  });
});

module.exports = router;