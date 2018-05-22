const info = require('./aws_rds_info'); 
 
module.exports = {
  user          : info.user, 
  password      : info.password, 
  connectString : info.connectString 
}; 
