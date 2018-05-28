var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');
var router = express.Router();
var alert = require('alert-node');
var moment = require('moment');

oracledb.autoCommit = true;

oracledb.getConnection(dbConfig, (err, connection) => {

  // 내 프로젝트 정보
  // 페이지 이동
  router.get('/myprojects', (req, res, next) => {
    var query = 'select p.project_name, c.client_name, p.begin_date, p.end_date, pi.role_in_project, pi.join_date, pi.out_date, pi.skill from project p, project_input pi, developer d, client c where p.num = pi.project_num and pi.developer_num = d.num and c.num = p.order_customer and d.id= \'' + req.session.user.ID + '\' and ';
    var date_condition1 = 'BEGIN_DATE <= trunc(sysdate) and END_DATE >= trunc(sysdate)';
    var date_condition2 = 'END_DATE < trunc(sysdate)';
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
        if (prj_cur.rows.length === 0 && prj_before.rows.length === 0) {
          alert('관련 프로젝트 정보가 없습니다.');
          return res.redirect('back');
        }
        res.render('developer/myprojects', { state: 'developer', prj_cur: prj_cur.rows, prj_before: prj_before.rows });
      });
    });
  });

  // 고객평가
  // 페이지 이동
  router.get('/customer_evaluation', (req, res, next) => {
    res.render('developer/customer_evaluation', { state: 'developer' });
  });

  // 고객평가
  // 등록처리
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

  // 동료평가
  // 페이지로 이동
  router.get('/aboutPeerEvaluation', (req, res, next) =>{
    user = req.session.user;
    //로그인 한 사용자가 속해있는 프로젝트 목록을 가져온다.
    connection.execute('select project.project_name from project,project_input,developer where developer.id=\''+ req.session.user.ID +'\' and developer.num=project_input.developer_num and project_input.project_num=project.num', (err,result) => {
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
  
  // 동료평가
  // 평가 할 개발자 선택 및 평가 페이지
  router.post('/selectEvaluated', (req, res, next) => {
    connection.execute('select project.num,project.project_name from project where project_name=\''+ req.body.project +'\'', (err, selectedP) => {
      console.log(selectedP);
      if(err){
        console.error(err.message);
        return;
      }
      //선택된 프로젝트 정보 가져옴
      var selected = '프로젝트 이름 : ' + selectedP.rows[0][1];
      //로그인한 사용자를 제외한 프로젝트에 참여했던 개발자 아이디 가져옴
      connection.execute('select developer.id from developer,project,project_input where project.project_name=\''+req.body.project+'\' and project.num=project_input.project_num and developer.num=project_input.developer_num and developer.id not in(\''+req.session.user.ID+'\')', (err, developer) =>{
        console.log(developer);
        if(err){
          console.error(err.message);
          return;
        }
        //선택된 프로젝트에서 로그인한 사용자의 직무를 select
        connection.execute('select project_input.role_in_project from project_input,project,developer where project.project_name=\''+req.body.project+'\' and project.num=project_input.project_num and developer.id=\''+req.session.user.ID+'\' and developer.num=project_input.developer_num', (err, result) => {
          console.log(result);
          //만약 직무가 pm이면 pm테이블에 insert
          if(result.rows === 'PM'){
            connection.execute('select * from pm_evaluation,project where project_name=\''+req.body.project+'\' and project.num=pm_evaluation.project_num', (err, result) => {
              if(result.rows.length === 0){
                connection.execute('insert into pm_evaluation values ((select num from project where project_name=\''+ req.body.project +'\'), (select developer.num from developer where id=\''+req.session.user.ID+'\'), (select num from developer where id=\''+req.body.evaluated+'\'),'+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')', (err, result) => {
                  if(err){
                    console.error(err.message);
                    return;
                  }
                });    
              }else{
                alert('이미 평가가 완료되었습니다.');
                return res.redirect('back');
              }
              return res.render('developer/selectEvaluated', {state:'developer', selected, project_name: req.body.project, developers:developer.rows,result:result.rows});            
            });
          }
          //직무가 pm이 아니면 동료테이블에 insert
          else{
            connection.execute('select * from peer_evaluation,project where project_name=\''+req.body.project+'\' and project.num=peer_evaluation.project_num', (err, result) => {
              if(result.rows.length === 0){
                connection.execute('insert into peer_evaluation values ((select num from project where project_name=\''+ req.body.project +'\'),(select num from developer where id=\''+req.session.user.ID+'\'),(select num from developer where id=\''+req.body.evaluated+'\'),'+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')', (err, result) => {
                  if(err){
                    console.error(err.message);
                    return;
                  }
                });    
              }else{
                alert('이미 평가가 완료되었습니다.');
                return res.redirect('back');
              }
              return res.render('developer/selectEvaluated', {state:'developer', selected,project_name: req.body.project,  developers:developer.rows,result:result.rows});            
            });
          }
        });
      });
    }); 
  });

  // 동료평가
  // 상세 페이지(개발자)
  // router.post('/peer_evaluation',(req, res, next) => {
  //   user = req.session.user;    

  // });

});

module.exports = router;