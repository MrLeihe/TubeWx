// pages/comment/comment.js

const app = getApp();
var API = require('../../utils/API.js');
var consoleUtil = require('../../utils/consoleUtil.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    commentMessage: '', 
    currentMarkerId: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      currentMarkerId: options.currentMarkerId
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
  
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
  
  },

  confirmClick: function(){
    this.sendComment();
  },

  clearClick: function(){
    this.setData({
      commentMessage: ''
    })
  },

  /**
   * 监听评论输入框变化
   */
  subscribeCommentInput: function (e) {
    this.setData({
      commentMessage: e.detail.value
    })
  },

  /**
   * 发送评论
   */
  sendComment: function () {
    var that = this;
    if (!that.data.commentMessage) {
      that.showModal('请写点什么吧~');
      return;
    }
    wx.request({
      url: API.obtainUrl(API.uploadCommentUrl),
      header: app.globalData.header,
      data: {
        info_id: that.data.currentMarkerId,
        message: that.data.commentMessage
      },
      success: function (res) {
        if (res.data.code == 1000) {
          that.showModal(res.msg);
          //回到 map 页面
          var pages = getCurrentPages();
          var prePage = pages[pages.length - 2];
          prePage.setData({
            commentCallback: true
          })
          wx.navigateBack({
            delta: 1,
          })
        } else {
          that.showModal(res.msg);
        }
      },
      fail: function (res) {
        that.showModal(res.msg);
      }
    })
  },

  showModal: function (message) {
    wx.showModal({
      title: '提示',
      content: message,
      showCancel: false
    });
  },
})