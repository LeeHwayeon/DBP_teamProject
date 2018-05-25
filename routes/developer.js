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
  // 페이지 이동
  router.get('/aboutPeerEvaluation', (req, res, next) =>{
    user = req.session.user;
    var projects = {};
    // 로그인 한 사용자가 속해있는 프로젝트 목록을 가져온다.
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

  // 동료평가 페이지(개발자)
  router.post('/topeer_evaluation',(req, res, next) => {
    // 선택된 프로젝트에서의 사용자 직무 검색 (선택된 프로젝트를 해줘야 한다.... 선택된...!!!!!!!!!!!!!!!!!)
    connection.execute('select project.project_name from project where project.project_name = \'' + req.body.project + '\'', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log(selectedPrj);
      var selected = '프로젝트명 : ' + selectedPrj.rows[0];

      // 선택된 프로젝트가 존재하지 않으면
      if(selectedPrj.rows.length === 0){
        if(err){
          console.error(err.message);
          return;
        }
        alert('평가할 프로젝트가 선택되지 않았습니다.');
        return res.redirect('back');
      }
      // 선택된 프로젝트가 있다면 평가 진행
      else{
        connection.execute('select project_input.role_in_project from project_input, developer, project where developer.id=\''+ req.session.user.ID +'\'  and developer.num=project_input.developer_num and project.num=project_input.project_num and project.project_name = \''+req.body.project + '\'', (err, result) =>{
          console.log(result);
          // 직무가 pm이면
          if(result.rows==='PM'){
            connection.execute('select * from pm_evaluation, project where project.num=pm_evaluation.project_num', (err, result) => {
              // 평가한 내용이 없다면
              if(result.rows.length === 0){
                if(err){
                  console.log(err.message);
                  return;
                }
                // 평가내용을 pm평가 테이블에 insert
                connection.execute('insert into pm_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
                  if(err){
                    console.log(err.message);
                    return;
                  }
                  alert('PM평가가 완료되었습니다.');
                  return res.render('index', { state : 'developer' });
                });
              }
              // 평가한 내용이 이미 있다면
              else{
                alert('이미 평가가 완료되었습니다.');
                return res.redirect('back');
              }
            });
          }
          // 직무가 pm아닌 개발자들이라면
          else{
            connection.execute('select * from peer_evaluation, project where project.num=peer_evaluation.project_num', (err, result) =>{
              // 평가한 내용이 없다면
              if(result.rows.length === 0){
                if(err){
                  console.log(err.message);
                  return;
                }
                // 평가 내용을 동료평가 테이블에 insert
                connection.execute('insert into peer_evaluation values(' + req.body.pnum+',' + req.body.evaluator+','+req.body.evaluated+','+req.body.work_score+',\''+req.body.work_content+'\','+req.body.communication_score +',\''+req.body.communication_content+'\')',(err, result)=>{
                  if(err){
                    console.error(err.message);
                    return;
                  }
                  alert('동료평가가 완료되었습니다.');
                  return res.render('index', { state : 'developer' });              
                });
              }
              // 평가한 내용이 이미 있다면
              else{
                alert('이미 평가가 완료되었습니다.');
                return res.redirect('back');
              }
            });
          } 
        });
      }
    });
  });

});

module.exports = router;