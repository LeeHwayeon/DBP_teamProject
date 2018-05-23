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
            return res.render('index', { state: 'management'});
          }
        });
      } else {
        // 개발자일때
        for (let i = 0; i < result.metaData.length; i++) {
          user[result.metaData[i].name] = result.rows[0][i];
        }
        user['job'] = 'developer';
        req.session.user = user; 
        res.render('index', { state: 'developer'});
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
    return res.render('mypage', { state: user['job'], user: user });
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
    connection.execute('select num, id, user_name, resident_registration_number, education, join_company_date, skill from developer', (err, developers) => {
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
      connection.execute('select num, id, user_name, resident_registration_number, education, join_company_date, skill from developer', (err, dev) => {
        if (err) {
          console.error(err.message);
          return;
        }
        return res.render('prjInput', { state: 'management', projects: prj.rows, developers: dev.rows });
      });
    });
  });
  
  // 프로젝트 인원 투입 페이지 : skill, 역할, 투입일 선택
  router.post('/configureInput', (req, res, next) => {
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.body.project + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      var selected = '프로젝트명 : ' + selectedPrj.rows[0][1] + ', 착수일자 : ' + moment(selectedPrj.rows[0][2]).format('YYYY-MM-DD') + ', 종료일자: ' + moment(selectedPrj.rows[0][3]).format('YYYY-MM-DD') + ', 발주처 : ' + selectedPrj.rows[0][4];

      // 선택한 개발자가 한 명인 경우
      if (typeof req.body.developer === 'string') {
        connection.execute('select num, id, user_name from developer where num = ' + req.body.developer + '', (err, developer) => {
          if (err) {
            console.error(err.message);
            return;
          }
          return res.render('configureInput', { state: 'management', selected, project_num: req.body.project, developer: developer.rows });
        });
      } else if (typeof req.body.developer === 'object') {
        // 선택한 개발자가 여러명인 경우
        var query = 'select num, id, user_name from developer where num = ' + req.body.developer[0];
        for (let i = 1; i < req.body.developer.length; i++) {
          query += ' or num = ' + req.body.developer[i];
        }
        connection.execute(query, (err, developer) => {
          if (err) {
            console.error(err.message);
            return;
          }
          return res.render('configureInput', { state: 'management', selected, project_num: req.body.project, developer: developer.rows });
        });
      } else {
        alert("선택된 개발자가 없습니다.");
        return res.redirect('back');
      }
    });
  });

  // 프로젝트 인원 투입 페이지 : Project input 테이블에 추가
  router.post('/addProjectInput', (req, res, next) => {
    if (typeof req.body.join_date === 'string') {
      // 한명
      if (req.body.join_date.length === 0) {
        alert("투입 날짜가 결정되지 않은 개발자가 있습니다. 다시 시도하십시오.");
        return res.render('index', { state: 'management'});
      }
      let query = 'insert into project_input values(' + req.body.project_num + ', ' + req.body.developer_num + ', \'' + req.body.role + '\', to_date(\'' + req.body.join_date + '\', \'yyyy-MM-dd\')' + ', null, \'' + req.body.skill + '\')';
      connection.execute(query, (err, result) => {
        if (err) {
          console.error(err.message);
          return;
        }
        connection.execute('update developer set skill = \'' + req.body.skill + '\' where num = ' + req.body.developer_num + '', (err, result) => {
          if (err) {
            console.error(err.message);
            return;
          }
        });
      });
    } else {
      // 여러명
      if (req.body.join_date.includes('')) {
        alert("투입 날짜가 결정되지 않은 개발자가 있습니다. 다시 시도하십시오.");
        return res.render('index', { state: 'management'});
      }
      for (let i = 0; i < req.body.developer_num.length; i++) {
        let query = 'insert into project_input values(' + req.body.project_num + ', ' + req.body.developer_num[i] + ', \'' + req.body.role[i] + '\', to_date(\'' + req.body.join_date[i] + '\', \'yyyy-MM-dd\')' + ', null, \'' + req.body.skill[i] + '\')';
        connection.execute(query, (err, result) => {
          if (err) {
            console.error(err.message);
            return;
          }
          connection.execute('update developer set skill = \'' + req.body.skill[i] + '\' where num = ' + req.body.developer_num[i] + '', (err, result) => {
            if (err) {
              console.error(err.message);
              return;
            }
          });
        });
      }
    }
    alert("해당 인원이 프로젝트에 투입되었습니다.");
    return res.render('index', { state: 'management' });
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

  // 평가조회 페이지
  router.get('/evaluation', (req, res, next) => {
    res.render('evaluation', { state: 'management' });
  });

  // 직원 관리 페이지(경영진)
  // 현재 프로젝트에 참여중인 직원들에 대한 정보만 있는 듯.
  router.get('/aboutDeveloper', (req, res, next) => {
    connection.execute('select developer.id, developer.user_name, developer.join_company_date, project.project_name, project_input.role_in_project, project_input.join_date,project_input.out_date, project_input.skill from developer, project_input, project where developer.num=project_input.developer_num and project.num=project_input.project_num',
    (err, result)=>{
      if(err){
        console.error(err.message);
        return;
      }
      return res.render('aboutDeveloper',{state:'management', result: result.rows});      
    });
  });

  //직원관리_검색창
  router.post('/showDeveloper', (req, res, next) => {
    connection.execute('select developer.id, developer.user_name, developer.join_company_date, project.project_name, project_input.role_in_project, project_input.join_date,project_input.out_date, project_input.skill from developer, project_input, project where developer.num=project_input.developer_num and project.num=project_input.project_num and developer.id = \'' + req.body.DeveloperId + '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      return res.render('aboutDeveloper', { state: 'management', result: result.rows});
    });
  });

  //동료평가(프로젝트 조회) 페이지로 이동
  router.get('/aboutPeerEvaluation', (req, res, next) =>{
    user = req.session.user;
    var projects = {};
    //로그인 한 사용자가 속해있는 프로젝트 목록을 가져온다.
    connection.execute('select project.project_name from project,project_input,developer where developer.id=\''+ req.session.user.ID +'\' and developer.num=project_input.developer_num and project_input.project_num=project.num', (err,result) => {
      if(err){
        console.log(err.message);
        return;
      }
      if(result.rows.length === 0){
        alert("평가할 프로젝트가 없습니다.");
        return res.redirect('back');
      }
      return res.render('aboutPeerEvaluation', {state:'developer', projects:result.rows});  
    });
  });
  
  //동료평가 페이지(개발자)
  router.post('/topeer_evaluation',(req, res, next) => {
    //선택된 프로젝트에서의 사용자 직무 검색 (선택된 프로젝트를 해줘야 한다.... 선택된...!!!!!!!!!!!!!!!!!)
    connection.execute('select project_input.role_in_project from project_input, developer where developer.id=\''+ req.session.user.ID +'\'  and developer.num=project_input.developer_num', (err, result) =>{
      console.log(result);
      //직무가 pm이면
      if(result.rows==='PM'){
        connection.execute('select * from pm_evaluation, project where project.num=pm_evaluation.project_num', (err, result) => {
          //평가한 내용이 없다면
          if(result.rows.length === 0){
            if(err){
              console.log(err.message);
              return;
            }
            //평가내용을 pm평가 테이블에 insert
            connection.execute('insert into pm_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
              if(err){
                console.log(err.message);
                return;
              }
              alert('PM평가가 완료되었습니다.');
              return res.render('index', { state : 'developer' });
            });
          }
          //평가한 내용이 이미 있다면
          else{
            alert('이미 평가가 완료되었습니다.');
            return res.redirect('back');
          }
        });
      }
      //직무가 pm아닌 개발자들이라면
      else{
        connection.execute('select * from peer_evaluation, project where project.num=peer_evaluation.project_num', (err, result) =>{
          //평가한 내용이 없다면
          if(result.rows.length === 0){
            if(err){
              console.log(err.message);
              return;
            }
            //평가 내용을 동료평가 테이블에 insert
            connection.execute('insert into peer_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
              if(err){
                console.error(err.message);
                return;
              }
              alert('동료평가가 완료되었습니다.');
              return res.render('index', { state : 'developer' });              
            });
          }
          //평가한 내용이 이미 있다면
          else{
            alert('이미 평가가 완료되었습니다.');
            return res.redirect('back');
          }
        });
      } 
    });
  });

  //내프로젝트 정보
  router.get('/myprojects', (req, res, next) => {
    connection.execute('select project_input.* from project_input, DEVELOPER where developer.id= \'' + req.session.user.ID + '\' and project_input.DEVELOPER_NUM = DEVELOPER.NUM', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
    }
      console.log(result.rows);
      return res.render('myprojects', { state: 'developer', result: result.rows });
    });
  });

  //고객평가 페이지로 이동
  router.get('/customer_evaluation', (req, res, next) => {
    res.render('customer_evaluation', { state: 'developer' });
  });

  //고객평가
  router.post('/customer_evaluation', (req, res, next) => {
    connection.execute('insert into customer_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=> {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("고객평가 등록 완료.");
      return res.render('customer_evaluation', { state: 'developer'});
    });
  });

  //프로젝트관리
  router.get('/aboutProject', (req, res, next) => {
    connection.execute('select * from project where BEGIN_DATE <= trunc(sysdate) and END_DATE >= trunc(sysdate)', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
    }
      console.log(result.rows);
      return res.render('aboutProject', { state: 'management', result: result.rows});
    });
  });

  //프로젝트관리_검색창
  router.post('/showProject', (req, res, next) => {
    connection.execute('select * from project where num = \'' + req.body.projectNum + '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      return res.render('aboutProject', { state: 'management', result: result.rows});
    });
  });

  //프로젝트 투입,방출
  router.get('/inAndOut', (req, res, next) => {
    connection.execute('', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
    }
      console.log(result.rows);
      return res.render('inAndOut', { state: 'management', result: result.rows});
    });
  });

});



module.exports = router;