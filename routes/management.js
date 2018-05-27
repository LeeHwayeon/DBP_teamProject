var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../oracle/dbconfig');
var router = express.Router();
var alert = require('alert-node');
var moment = require('moment');

oracledb.autoCommit = true;

oracledb.getConnection(dbConfig, (err, connection) => {
  /* 
    1. 직원 관리
  */
  // 페이지 이동
  router.get('/aboutDeveloper', (req, res, next) => {
    connection.execute('select id,user_name,join_company_date from developer', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/aboutDeveloper', { state: 'management', result: result.rows });
    });
  });

  // 검색
  router.post('/showDeveloper', (req, res, next) => {
    var query = 'select id,user_name,join_company_date from developer where ';
    query += req.body.selected_search_key === 'id' ? 'id' : 'user_name';
    query += ' = \'' + req.body.search_key + '\'';

    connection.execute(query, (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/aboutDeveloper', { state: 'management', result: result.rows });
    });
  });

  // 삭제
  router.delete('/showDeveloper', (req, res, next) => {
    // TODO: 여러명 삭제
    var query = 'select count(*) from pm, developer d where d.num = pm.developer_num and ';
    if (typeof req.body.for_deleted === 'object') {
      query += '(';
      for (let i = 0; i < req.body.for_deleted.length; i++) {
        query += 'd.id = \'' + req.body.for_deleted[i] + '\' or ';
      }
      query = query.slice(0, -3);
      query += ')';
    } else if (typeof req.body.for_deleted === 'string') {
      query += 'd.id = \'' + req.body.for_deleted + '\'';
    } else {
      alert('삭제할 직원을 선택하세요.');
      return res.redirect('back');
    }

    connection.execute(query, (err, isPm) => {
      if (err) {
        console.error(err.message);
        return;
      }
      if (isPm.rows[0] > 0) {
        // PM인 개발자
        alert('PM으로 등록된 개발자는 삭제할 수 없습니다.');
        return res.redirect('/management/aboutDeveloper');
      } else {
        // PM 아닌 개발자. 이제 프로젝트 투입 테이블 체크
        let q = 'select count(*) from project_input pi, developer d where d.num = pi.developer_num and ';
        if (typeof req.body.for_deleted === 'object') {
          q += '(';
          for (let i = 0; i < req.body.for_deleted.length; i++) {
            q += 'd.id = \'' + req.body.for_deleted[i] + '\' or ';
          }
          q = query.slice(0, -3);
          q += ')';
        } else {
          q += 'd.id = \'' + req.body.for_deleted + '\'';
        }

        connection.execute(q, (err, isWork) => {
          if (err) {
            console.error(err.message);
            return;
          }
          if (isWork.rows[0] > 0) {
            // 투입이력이 있는
            alert('프로젝트 투입 이력이 있는 개발자는 삭제할 수 없습니다.');
            return res.redirect('/management/aboutDeveloper');
          } else {
            // 진짜 삭제
            connection.execute('delete from developer where id = \'' + req.body.for_deleted + '\'', (err, result) => {
              if (err) {
                console.error(err.message);
                return;
              }
              alert('삭제되었습니다.');
              res.redirect('back');
            });
          }
        });
      }
    });
  });

  // 상세 페이지
  router.get('/detail/:id', (req, res, next) => {
    // 선택된 개발자의 정보를 알려줌
    connection.execute('select id, user_name, resident_registration_number, education, join_company_date, skill from developer where id=\'' + req.params.id + '\'', (err, selectedD) => {
      if (err) {
        console.err(err.message);
        return;
      }
      
      var selected = {
        'name': selectedD.rows[0][1],
        'rrn': selectedD.rows[0][2],
        'school': selectedD.rows[0][3],
        'join_date': moment(selectedD.rows[0][4]).format('YYYY-MM-DD'),
        'skill': (selectedD.rows[0][5] === null ? 'empty' : selectedD.rows[0][5]),
      };
      
      var query = 'select p.project_name, c.client_name, p.begin_date, p.end_date, pi.role_in_project, pi.join_date, pi.out_date, pi.skill, p.num from project p, project_input pi, developer d, client c where p.num = pi.project_num and pi.developer_num = d.num and c.num = p.order_customer and d.id= \'' + req.params.id + '\' and ';
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
            res.render('management/aboutDeveloperDetail', { state: 'management', selected, prj_cur: prj_cur.rows, prj_before: prj_before.rows, prj_future: prj_future.rows });
          });
        });
      });
    });
  });





  /* 
    2. 고객 관리
  */
  // 페이지 이동
  router.get('/aboutClient', (req, res, next) => {
    connection.execute('select * from client', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/aboutClient', { state: 'management', clients: result.rows });
    });
  });

  // 고객 등록 페이지로 이동
  router.get('/addClient', (req, res, next) => {
    res.render('management/addClient', { state: 'management' });
  });

  // 고객 등록
  router.post('/addClient', (req, res, next) => {
    connection.execute('insert into client(num, client_name, contact) values(seq_client.nextval, \'' + req.body.name + '\', \'' + req.body.contact + '\')', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("고객이 등록되었습니다.");
      res.render('index', { state: 'management' });
    });
  });

  // 고객 상세 페이지로 이동
  router.get('/client/:id', (req, res, next) => {
    connection.execute('select client_name, contact from client where num = ' + req.params.id + '', (err, client) => {
      if (err) {
        console.error(err.message);
        return;
      }

      var query = 'select p.project_name, p.begin_date, p.end_date, p.num from project p, client c where c.num = p.order_customer and c.num = \'' + req.params.id + '\' and ';
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
            if (prj_cur.rows.length === 0 && prj_before.rows.length === 0 && prj_future.rows.length === 0) {
              alert('의뢰한 프로젝트가 없습니다.');
              return res.redirect('back');
            }
            res.render('management/detailClient', { state: 'management', client: client.rows, prj_cur: prj_cur.rows, prj_before: prj_before.rows, prj_future: prj_future.rows });
          });
        });
      });
    });
  });





  /* 
    3. 프로젝트 관리
  */
  // 페이지 이동
  router.get('/aboutProject', (req, res, next) => {
    var query = 'select p.num, p.project_name, c.client_name, p.begin_date, p.end_date from project p, client c where c.num = p.order_customer and ';
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
          if (prj_cur.rows.length === 0 && prj_before.rows.length === 0 && prj_future.rows.length === 0) {
            alert('프로젝트 내역이 없습니다.');
            return res.redirect('back');
          }
          res.render('management/aboutProject', { state: 'management', prj_cur: prj_cur.rows, prj_before: prj_before.rows, prj_future: prj_future.rows });
        });
      });
    });
  });

  // 프로젝트 상세페이지로 이동
  router.get('/prj/:id', (req, res, next) => {
    connection.execute('select p.project_name, p.begin_date, p.end_date, c.num as client_num, c.client_name, p.num from project p, client c where c.num = p.order_customer and p.num = \'' + req.params.id + '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      // PM이 아닌 인원들에 대해서만 정보 출력
      connection.execute('select d.id, d.user_name, pi.role_in_project, pi.join_date, pi.out_date, d.skill from project_input pi, developer d where d.num = pi.developer_num and pi.role_in_project != \'pm\' and pi.project_num = \'' + req.params.id + '\'', (err, pi_result) => {
        if (err) {
          console.error(err.message);
          return;
        }
        // TODO: PM 지정 전에는 프로젝트 인원투입 불가하도록.
        connection.execute('select id, user_name from developer where num = (select developer_num from pm where project_num = \'' + req.params.id + '\')', (err, pm_result) => {
          if (err) {
            console.error(err.message);
            return;
          }
          res.render('management/aboutProjectDetail', { state: 'management', result: result.rows, pi: pi_result.rows, pm: pm_result.rows });
        })
      });
    });
  });

  // PM으로 등록/변경할 개발자 선택 페이지
  router.get('/appointPM/:pNum', (req, res, next) => {
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.num, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.params.pNum + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/appointPM', { state: 'management', project_num: req.params.pNum, selected: selectedPrj.rows});
    });
  });

  // 개발자 검색
  router.post('/showDevToPm', (req, res, next) => {
    if (req.body.search_key.length === 0) {
      alert('다시 시도하십시오.');
      return res.redirect('back');
    }
    var dId = req.body.search_key;
    var project_num = req.body.project_num;

    connection.execute('select count(*) from developer d, pm where pm.developer_num = d.num and d.id = \'' + dId + '\'', (req, pmCount) => {
      if (err) {
        console.error(err.message);
        return;
      }
      connection.execute('select project_name, c.client_name, p.begin_date, p.end_date from developer d, pm, project p, client c where pm.developer_num = d.num and d.id = \'' + dId + '\' and pm.project_num = p.num and BEGIN_DATE <= trunc(sysdate) and END_DATE >= trunc(sysdate) and c.num = p.order_customer', (err, curPrj) => {
        if (err) {
          console.error(err.message);
          return;
        }
        connection.execute('select num, user_name, join_company_date from developer where id = \'' + dId + '\'', (err, dev) => {
          if (err) {
            console.error(err.message);
            return;
          }
          res.render('management/appointPM', { state: 'management', project_num, pmCount: pmCount.rows[0][0], curPrj: curPrj.rows, dev: dev.rows[0]});
        })
      });
    });
  });

  // PM 등록/변경 처리
  router.post('/addPMtable', (req, res, next) => {
    var prj = req.body.project_num;
    var dev = req.body.developer;

    if (req.body.developer === undefined) {
      alert("PM으로 선택된 개발자가 없습니다.");
      return res.redirect("/");
    }

    // TODO: 유효하지 않은 투입일 체크.
    if (req.body.join_date.length === 0) {
      alert("투입일을 입력하세요.");
      return res.redirect("/management/prj/" + prj);
    }
    
    // PK가 개발자번호 + 플젝번호라 이미 다른 직무를 맡고있는 경우 인풋테이블에 PM으로 못들어감.
    connection.execute('select count(*) from project_input where project_num = ' + prj + ' and developer_num = ' + dev, (err, pi_flag) => {
      if (err) {
        console.error(err.message);
        return;
      }

      if (pi_flag.rows[0][0] === 1) {
        alert('이미 다른 직무를 맡고 있어 PM 설정이 불가능합니다.');
        return res.redirect("/management/prj/" + prj);
      }

      connection.execute('select count(*) from pm where project_num = \'' + prj + '\'', (err, pm_flag) => {
        if (err) {
          console.error(err.message);
          return;
        }  
        if (pm_flag.rows[0][0] === 0) {
          // insert
          connection.execute('insert into pm(developer_num, project_num) values(' + dev + ', ' + prj + ')', (err, result) => {
            if (err) {
              console.error(err.message);
              return;
            }
            // input테이블에도 pm을 넣어야 하는가? -> 이 사람에 관련된 프로젝트 정보 조회 위해.
            connection.execute('insert into project_input(project_num, developer_num, role_in_project, join_date, out_date, skill) values(' + prj + ', ' + dev + ', ' + '\'pm\', to_date(\'' + req.body.join_date + '\', \'yyyy-MM-dd\'), null, null)', (err, result) => {
              if (err) {
                console.error(err.message);
                return;
              }
              alert("PM이 등록되었습니다.");
              return res.redirect('/management/prj/' + prj);
            });
          });
        } else {
          // update
          connection.execute('select developer_num from pm where project_num = ' + prj, (err, before) => {
            if (err) {
              console.error(err.message);
              return;
            }
            connection.execute('update pm set developer_num = \'' + dev + '\' where project_num = \'' + prj + '\'', (err, result) => {
              if (err) {
                console.error(err.message);
                return;
              }
              
              // 이전 개발자 번호..?
              connection.execute('update project_input set developer_num = ' + dev + ' where project_num = ' + prj + ' and developer_num = ' + before.rows[0][0] + '', (err, result) => {
                if (err) {
                  console.error(err.message);
                  return;
                }
                alert("PM이 변경되었습니다.");
                return res.redirect('/management/prj/' + prj);
              });
            });
          });
        }
      });
    });
  });

  // 프로젝트 등록 페이지로 이동
  router.get('/addProject', (req, res, next) => {
    connection.execute('select * from client', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/addProject', { state: 'management', clients: result.rows });
    });
  });

  // 프로젝트 등록처리
  router.post('/addProject', (req, res, next) => {
    if (moment.duration(moment(req.body.begin_date).diff(req.body.end_date)).asDays().toFixed(1) > 0) {
      alert('시작일은 종료일 이전이어야 합니다.');
      return res.redirect('back');
    }

    connection.execute('insert into project(num, project_name, begin_date, end_date, order_customer) values(seq_project.nextval, \'' + req.body.name + '\', to_date(\'' + req.body.begin_date + '\', \'yyyy-MM-dd\'), to_date(\'' + req.body.end_date + '\', \'yyyy-MM-dd\'), ' + req.body.client + ')', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("프로젝트가 등록되었습니다.");
      res.redirect('/management/aboutProject');
    });
  });

  // 인원투입 페이지로 이동
  router.get('/prjInput/:id', (req, res, next) => {
    console.log(req.params.id);
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.num, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.params.id + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }

      connection.execute('select num, id, user_name, resident_registration_number, join_company_date, skill from developer', (err, dev) => {
        if (err) {
          console.error(err.message);
          return;
        }
        res.render('management/prjInput', { state: 'management', developers: dev.rows, selected: selectedPrj.rows });
      });
    });
  });

  // 인원 투입 관련 입력받기
  router.post('/configureInput', (req, res, next) => {
    connection.execute('select project.num, project.project_name, project.begin_date, project.end_date, client.num, client.client_name from project, client where project.order_customer = client.num and project.num = ' + req.body.project + '', (err, selectedPrj) => {
      if (err) {
        console.error(err.message);
        return;
      }

      // 선택한 개발자가 한 명인 경우
      if (typeof req.body.developer === 'string') {
        connection.execute('select num, id, user_name from developer where num = ' + req.body.developer + '', (err, developer) => {
          if (err) {
            console.error(err.message);
            return;
          }
          return res.render('management/configureInput', { state: 'management', selected, project_num: req.body.project, developer: developer.rows });
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
          return res.render('management/configureInput', { state: 'management', selected: selectedPrj.rows , project_num: req.body.project, developer: developer.rows });
        });
      } else {
        alert("선택된 개발자가 없습니다.");
        return res.redirect('back');
      }
    });
  });

  // 인원 투입 처리
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
        return res.redirect('');
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
    res.render('index', { state: 'management' });
  });





  /* 
    6. 개발자 투입 방출(이후 프로젝트 관리랑 병합 예정)
  */
  // 페이지 이동
  router.get('/inAndOut', (req, res, next) => {
    // 진행중인 프로젝트만 보여줌_프로젝트가 진행중일때만 개발자의 투입방출일자를 수정하도록
    connection.execute('select project.num, project_name, begin_date, end_date, client_name from project, client where client.num = project.order_customer and BEGIN_DATE <= trunc(sysdate) and END_DATE >= trunc(sysdate)', (err, projects) => {
      if (err) {
        console.error(err.message);
        return;
      }
      res.render('management/inAndOut', { state: 'management', projects: projects.rows });
    });
  });

  // 투입,방출일자를 수정하고 싶은 개발자 선택
  router.post('/appointToModify', (req, res, next) => {
    if (req.body.prj === undefined) {
      alert("선택된 프로젝트가 없습니다.");
      return res.redirect("back");
    }
    connection.execute('select num, id, user_name, join_date, out_date from project_input, developer where developer.num (+)= project_input.developer_num and project_input.project_num = ' +  req.body.prj + '' , (err, developers) => {
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
        res.render('management/appointToModify', { state: 'management', developer: developers.rows, project_num: req.body.prj, selected });
      });
    });
  });

  // 투입,방출일자 수정 처리
  router.post('/modifiedInAndOut', (req, res, next) => {
    if (req.body.developer === undefined) {
      alert("선택된 개발자가 없습니다.");
      return res.redirect("/");
    }

    connection.execute('update project_input set join_date = \'' +  req.body.join_date + '\', out_date = \'' + req.body.out_date + '\' where developer_num = \'' + req.body.developer +'\' and project_num = \'' + req.body.project_num+ '\'', (err, result) => {
      if (err) {
        console.error(err.message);
        return;
      }
      alert("수정완료");
      res.render('index', { state: 'management' });
    });
  });





  /* 
    7. 평가조회
  */
  // 평가조회 페이지
  router.get('/evaluation',(req, res, next) => {
    // 동료평가목록
    var projects={};
    connection.execute('SELECT DISTINCT project_num, project_name FROM project, PEER_EVALUATION WHERE project.NUM (+) = PEER_EVALUATION.PROJECT_NUM',(err,projects) =>{
      console.log(projects)
      if(err){
        console.log(err.message);
        return;
      }  
    
      // 고객평가목록
      var customers={};
      connection.execute('select project_num, project.project_name from project, customer_evaluation where project.num = customer_evaluation.project_num', (err,customers) =>{
        if(err){
          console.log(err.message);
          return;
        }
        return res.render('management/evaluation', {state: 'management', projects: projects.rows, customers:customers.rows });
      });
    });
  });

  // 동료평가 상세페이지
  router.get('/peerEvaluationDetail/:id',(req, res, next) => {
    id = req.params.id
    console.log(id)
    connection.execute('select * from peer_evaluation where peer_evaluation.project_num = \'' + id + '\'', (err,result) => {
      if(err){
        console.log(err.message);
        return;
      }
      console.log(result);
      return res.render('management/peerEvaluationDetail', { state: 'management', result: result.rows });  
    });
  });

  // 고객평가 상세페이지
  router.get('/customerEvaluationDetail/:id', (req, res, next) => {
    id = req.params.id
    console.log(id)
    connection.execute('select * from customer_evaluation where customer_evaluation.project_num = \'' + id + '\'', (err,result) => {
      if(err){
        console.log(err.message);
        return;
      }
      console.log(result);
      return res.render('management/customerEvaluationDetail', { state: 'management', result: result.rows });  
    });
  });
});

module.exports = router;