/** 服务器api相关 */

const debug = false;
var domain;


//domainName 后面拼接的接口名
function obtainUrl(url){
  if(!debug){
    domain = 'https://wxapi.benpaobao.com/traffic/';
  }else{
    domain = 'http://192.168.1.114:8000/traffic/';
  }
  console.log('domain---------->' + domain);
  return domain + url;
}

//微信帐号登录接口
const loginUrl = 'app/user/wx_login';
//上传情报
const uploadInfoUrl = 'app/user/upload_info';
//根据经纬度获取周围情报
const queryInfoUrl = 'app/user/query_info';
//根据情报ID获取情报和评论
const queryCommentUrl = 'app/user/query_info_detail';
//评论情报
const uploadCommentUrl = 'app/user/upload_comment';
//点赞情报
const  likeUrl= 'app/user/like';
//获取最新情报
const queryNewInfoUrl = 'app/user/query_info_newest';

module.exports = {
  obtainUrl: obtainUrl,
  loginUrl: loginUrl,
  uploadInfoUrl: uploadInfoUrl,
  queryInfoUrl: queryInfoUrl,
  queryCommentUrl: queryCommentUrl,
  uploadCommentUrl: uploadCommentUrl,
  likeUrl: likeUrl,
  queryNewInfoUrl: queryNewInfoUrl,
}