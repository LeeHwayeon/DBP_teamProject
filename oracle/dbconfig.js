module.exports = {
    user          : process.env.NODE_ORACLEDB_USER || "exam_a",
    password      : process.env.NODE_ORACLEDB_PASSWORD || "delab",
    connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING || "localhost/xe",
    externalAuth  : process.env.NODE_ORACLEDB_EXTERNALAUTH ? true : false
  };