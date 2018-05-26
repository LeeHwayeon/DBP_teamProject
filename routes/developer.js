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
    connection.execute('select project_input.* from project_input, DEVELOPER where developer.id= \'' + req.session.user.ID + '\' and project_input.DEVELOPER_NUM = DEVELOPER.NUM', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('developer/myprojects', { state: 'developer', result: result.rows });
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
  // 평가 할 개발자 선택 페이지
  router.post('/selectEvaluated', (req, res, next) => {
    connection.execute('select project.num,project.project_name from project where project_name=\''+ req.body.project +'\'', (err, selectedP) => {
      console.log(selectedP);
      if(err){
        console.error(err.message);
        return;
      }
      //선택된 프로젝트 정보 가져옴
      var selected = '프로젝트 이름 : ' + selectedP.rows[0][1];
      connection.execute('select developer.id from developer,project,project_input where project.project_name=\''+req.body.project+'\' and project.num=project_input.project_num and developer.num=project_input.developer_num and developer.id not in(\''+req.session.user.ID+'\')', (err, developer) =>{
        console.log(developer);
        if(err){
          console.error(err.message);
          return;
        }
        return res.render('developer/selectEvaluated', {state:'developer', selected, project_name: req.body.project, developers:developer.rows});
      });
    }); 
  });

  // 동료평가
  // 상세 페이지(개발자)
  router.post('/peer_evaluation',(req, res, next) => {
    user = req.session.user;    
    connection.execute('select project.num,project.project_name,developer.id from project,developer,project_input where project.project_name=\''+ req.body.project +'\' and project.num=project_input.project_num and developer.id=\''+req.body.evaluated+'\' and developer.num=project_input.developer_num', (err, selectedP) => {
      console.log(selectedP);
      if(err){
        console.error(err.message);
        return;
      }
      //선택된 프로젝트 정보 가져옴
      var selected = '프로젝트 이름 : ' + selectedP.rows[0][1] + '피평가자 아이디 : ' +selectedP.rows[0][2];
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
            return res.render('developer/peer_evaluation', {state:'developer', selected, project_name: req.body.project, result:result.rows});            
          });
        }
        //직무가 pm이 아니면 동료테이블에 insert
        else{
          connection.execute('select * from peer_evaluation,project where project_name=\''+req.body.project+'\' and project.num=peer_evaluation.project_num', (err, result) => {
            if(result.rows.length === 0){
              connection.execute('insert into peer_evaluation values ((select num from project where project_name=\''+ req.body.project +'\'),(select developer.num from developer where id=\''+req.session.user.ID+'\'),(select num from developer where id=\''+req.body.evaluated+'\'),'+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')', (err, result) => {
                if(err){
                  console.error(err.message);
                  return;
                }
              });    
            }else{
              alert('이미 평가가 완료되었습니다.');
              return res.redirect('back');
            }
            return res.render('developer/peer_evaluation', {state:'developer', selected,project_name: req.body.project,  result:result.rows});            
          });
        }
      });
    });
  });

});

module.exports = router;