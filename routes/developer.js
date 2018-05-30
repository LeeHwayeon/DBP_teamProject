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

  // 내 프로젝트 정보
  // 페이지 이동
  router.get('/myprojects', (req, res, next) => {
    var query = 'select p.project_name, c.client_name, p.begin_date, p.end_date, pi.role_in_project, pi.join_date, pi.out_date, pi.skill from project p, project_input pi, developer d, client c where p.num = pi.project_num and pi.developer_num = d.num and c.num = p.order_customer and d.id= \'' + req.session.user.ID + '\' and ';
    var date_condition1 = 'BEGIN_DATE <= trunc(sysdate) and END_DATE >= trunc(sysdate)';
    var date_condition2 = 'BEGIN_DATE < trunc(sysdate) and END_DATE < trunc(sysdate)';
    var date_condition3 = 'BEGIN_DATE > trunc(sysdate) and END_DATE > trunc(sysdate)';

    connection.execute(query + date_condition1, (err, prj_cur) => {
      if (err) {
        console.error(err.message);
        return;
      }
      connection.execute(query + date_condition2, (err, prj_before) => {
        if (err) {
          console.error(err.message);
          return;
        }
        connection.execute(query + date_condition3, (err, prj_future) => {
          if (err) {
            console.error(err.message);
            return;
          }
          if (prj_cur.rows.length === 0 && prj_before.rows.length === 0 && prj_future.rows.length == 0) {
            alert('관련 프로젝트 정보가 없습니다.');
            return res.redirect('back');
          }
          res.render('developer/myprojects', { state: 'developer', prj_cur: prj_cur.rows, prj_before: prj_before.rows, prj_future: prj_future.rows });
        });
      });
    });
  });

  // 고객평가
  // 페이지 이동
  router.get('/aboutCustomerEvaluation', (req, res, next) => {
    // 유저가 PM을 맡은 완료된 프로젝트 중에서 고객평가가 등록되지 않은 프로젝트 정보
    var query = 'select p.num, project_name, begin_date, end_date, client_name from project p, client c, pm where p.order_customer = c.num and p.num = pm.PROJECT_NUM and pm.DEVELOPER_NUM = (select num from developer where id = \'' + req.session.user.ID + '\') and p.END_DATE < trunc(sysdate)';
    query += ' minus select p.num, project_name, begin_date, end_date, client_name from project p, client c, customer_evaluation ce, developer d where ce.project_num = p.num and ce.EVALUATOR = c.NUM and d.num = ce.EVALUATED and ce.EVALUATED = (select num from developer where id = \'' + req.session.user.ID + '\') and p.order_customer = c.num';
    
    connection.execute(query, (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }

      if (result.rows.length === 0){
        alert("평가할 프로젝트가 없습니다.");
        return res.redirect('back');
      }
      res.render('developer/aboutCustomerEvaluation', { state: 'developer',  projects: result.rows });  
    });
  });

  // 고객평가 작성 페이지로 이동
  router.get('/cEval/:id', (req, res, next) => {
    var pNum = req.params.id;

    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project, client where project.order_customer = client.num and project.num = ' + pNum + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      
      res.render('developer/customer_evaluation', { state: 'developer', pNum, selected: selectedPrj.rows });
    });
  });
  
  // 고객평가처리
  router.post('/addCustomer_evaluation/:pNum', (req, res, next) => {
    console.log('insert into customer_evaluation values(' + req.params.pNum + ',(select client.num from client, project where project.order_customer = client.num and project.num =\''+req.params.pNum+'\'), (select num from developer where id = \'' + req.session.user.ID + '\'),'+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')');
    connection.execute('insert into customer_evaluation values(' + req.params.pNum + ',(select client.num from client, project where project.order_customer = client.num and project.num =\''+req.params.pNum+'\'), (select num from developer where id = \'' + req.session.user.ID + '\'),'+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')', (err, result)=> {
      if (err) {
        console.error(err.message);
        return;
      }

      alert("평가가 등록되었습니다.");
      res.render('index', { state: 'developer'});
    });
  });

  // 동료평가
  // 평가 프로젝트 선택 페이지
  router.get('/aboutPeerEvaluation', (req, res, next) =>{
    var projects={};
    // 로그인 한 사용자가 속해있으면서 완료된 프로젝트 목록을 가져온다.
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project,project_input,developer,client where project.order_customer=client.num and developer.id=\''+ req.session.user.ID +'\' and developer.num=project_input.developer_num and project_input.project_num=project.num MINUS select project.num, project_name, begin_date, end_date, client_name from client, project, PM, developer where client.num = project.order_customer and project.num = PM.PROJECT_NUM and PM.DEVELOPER_NUM = developer.NUM and id = \'' + req.session.user.ID + '\' and project.END_DATE < trunc(sysdate)', (err,result) => {
      if(err){
        console.error(err.message);
        return;
      }
      if(result.rows.length === 0){
        alert("평가할 프로젝트가 없습니다.");
        return res.redirect('back');
      }
      return res.render('developer/aboutPeerEvaluation', {state:'developer', projects:result.rows});  
    });
  });
  
  // 동료평가 작성
  router.post('/peer_evaluation', (req, res, next) => {
    if (req.body.prj === undefined) {
      alert("선택된 프로젝트가 없습니다.");
      return res.redirect("back");
    }
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.body.prj + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      var selected = '프로젝트명 : ' + selectedPrj.rows[0][1] + ', 착수일자 : ' + moment(selectedPrj.rows[0][2]).format('YYYY-MM-DD') + ', 종료일자: ' + moment(selectedPrj.rows[0][3]).format('YYYY-MM-DD') + ', 발주처 : ' + selectedPrj.rows[0][4];
      res.render('developer/peer_evaluation', { state: 'developer', project_num: req.body.prj, selected });
    });
  }); 

  //동료평가 처리
  router.post('/addPeer_evaluation',(req, res, next) => {
    connection.execute('insert into peer_evaluation values ('+ req.body.pnum +', (select num from developer where id=\''+req.session.user.ID+'\'),'+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=> {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("동료평가 등록 완료.");
      return res.render('index', { state: 'developer'});
    });
  });

  // PM평가
  // 평가 프로젝트 선택 페이지
  router.get('/aboutPMEvaluation', (req, res, next) =>{
    //자신이 PM이면서 완료된 프로젝트만 보여줌
    connection.execute('select project.num, project_name, begin_date, end_date, client_name from client, project, PM, developer where client.num = project.order_customer and project.num = PM.PROJECT_NUM and PM.DEVELOPER_NUM = developer.NUM and id = \'' + req.session.user.ID + '\' and project.END_DATE < trunc(sysdate)', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }      
      if(result.rows.length === 0){
        alert("평가할 프로젝트가 없습니다.");
        return res.redirect('back');
      }
      res.render('developer/aboutPMEvaluation', { state: 'developer',  projects: result.rows });  
    });
  });
  
  // PM평가 작성
  router.post('/pm_evaluation', (req, res, next) => {
    if(req.body.prj === undefined){
      alert("선택된 프로젝트가 없습니다.");
      return res.redirect("back");
    }
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.body.prj + '', (err, selectedPrj) => {
      if(err){
        console.error(err.message);
        return;
      }
      //선택된 프로젝트 정보 가져옴
      var selected = '프로젝트명 : ' + selectedPrj.rows[0][1] + ', 착수일자 : ' + moment(selectedPrj.rows[0][2]).format('YYYY-MM-DD') + ', 종료일자: ' + moment(selectedPrj.rows[0][3]).format('YYYY-MM-DD') + ', 발주처 : ' + selectedPrj.rows[0][4];
      res.render('developer/pm_evaluation', {state:'developer', selected, project_num: req.body.prj});
    });
  }); 

  //PM평가 처리
  router.post('/addPM_evaluation',(req, res, next) => {
    connection.execute('insert into pm_evaluation values ('+ req.body.pnum +', (select num from developer where id=\''+req.session.user.ID+'\'),'+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=> {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("PM평가 등록 완료.");
      return res.render('index', { state: 'developer'});
    });
  });
});

module.exports = router;