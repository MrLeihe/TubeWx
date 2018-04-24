//index.js
//获取应用实例
const app = getApp();
var API = require('../../utils/API.js');
var consoleUtil = require('../../utils/consoleUtil.js');
var coordtransform = require('../../utils/coordtransform.js');
var constant = require('../../utils/constant.js');
var QQMapWX = require('../../libs/qqmap-wx-jssdk.js');
//定义全局变量
var wxMarkerData = [];
var topHeight = 0;
var bottomHeight = 0;
var windowHeight = 0;
var windowWidth = 0;
var mapId = 'myMap';
var qqmapsdk;
var sourceType = [
  ['camera'],
  ['album'],
  ['camera', 'album']
]
var sizeType = [
  ['compressed'],
  ['original'],
  ['compressed', 'original']
]
//定时器，用于循环定时请求定位
var timer;

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    longitude: '',
    latitude: '',
    markers: [],
    showTopTip: false,
    warningText: '',
    showUpload: true,
    showConfirm: false,
    showComment: false,
    //地图高度
    mapHeight: 0,
    infoAddress: '',
    commentCount: 0,
    praiseCount: 0,
    commentList: [],
    selectAddress: '',
    centerLongitude: '',
    centerLatitude: '',
    uploadImagePath: '',
    currentMarkerId: 0,
    praiseSrc: '../../img/bottom-unpraise.png',
    warningIconUrl: '',
    infoMessage: '',
    isUp: false,
    //中心指针，不随着地图拖动而移动
    controls: [],
    //搜索到的中心区域地址信息,用于携带到选择地址页面
    centerAddressBean: null,
    //选择地址后回调的实体类
    callbackAddressInfo: null,
    //将回调地址保存
    callbackLocation: null,
    //当前省份
    currentProvince: '',
    //当前城市
    currentCity: '',
    //当前区县
    currentDistrict: '',
    showHomeActionIcon: true,
    homeActionLeftDistance: '0rpx',
    //最新显示的情报id
    lastNewMarkerId: 0,
    //最新的情报点纬度
    lastNewMarkerLat: '',
    //最新的情报点经度
    lastNewMarkerLng: '',
    //单个 marker 情报
    currentTipInfo: '',
    //显示评论输入框
    showCommentInput: false,
    //评论文字
    commentMessage: '',
    //分享携带经度
    shareLongitude: '',
    //分享携带纬度
    shareLatitude: '',
    //是否是分享点击进入小程序
    showShare: false,
  },

  onLoad: function (options) {
    var that = this;
    if (app.globalData.userInfo) {
      consoleUtil.log(1);
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
      that.userLogin();
    } else {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      consoleUtil.log(2);
      app.userInfoReadyCallback = res => {
        consoleUtil.log(3);
        app.globalData.userInfo = res.userInfo;
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        that.userLogin();
      }
    }
    that.scopeSetting();
    //分享携带情报id， 说明是通过分享的链接进入小程序的
    if (options.shareMarkerId) {
      that.setData({
        showShare: true,
        shareLongitude: options.shareLng,
        shareLatitude: options.shareLat,
        currentMarkerId: options.shareMarkerId
      })
    }
  },

  onShow: function () {
    consoleUtil.log('onShow--------------------->');
    var that = this;
    that.changeMapHeight();
    that.setHomeActionLeftDistance();
    //如果刚从选择地址页面带数据回调回来，则显示选择的地址
    consoleUtil.log(that.data.callbackAddressInfo)
    if (that.data.callbackAddressInfo == null) {
      that.getCenterLocation();
      //正在上传的话，不去请求地理位置信息
      if (that.data.showUpload) {
        that.requestLocation();
      }
    } else {
      that.setData({
        selectAddress: that.data.callbackAddressInfo.title,
        callbackLocation: that.data.callbackAddressInfo.location
      })
      //置空回调数据，即只使用一次，下次中心点变化后就不再使用
      that.setData({
        callbackAddressInfo: null
      })
    }
  },

  /**
   * 页面不可见时
   */
  onHide: function () {

  },

  /**
   * 定时请求当前位置(每隔30秒请求一次)
   */
  requestLocationOnTime: function () {
    var that = this;
    timer = setInterval(function () {
      that.requestLocation();
    }, 30000)
  },

  /**
   * 查询最新情报
   */
  queryNewInfo: function (lat, lng) {
    var that = this;
    wx.request({
      url: API.obtainUrl(API.queryNewInfoUrl),
      header: app.globalData.header,
      data: {
        lat: lat,
        lng: lng
      },
      success: function (res) {
        if (res.data.code == 1000) {
          var dataList = res.data.data;
          if (dataList.length != 0) {
            that.setData({
              lastNewMarkerId: dataList[0].info_id,
              warningText: dataList[0].message,
              showTopTip: true,
              lastNewMarkerLat: dataList[0].lat,
              lastNewMarkerLng: dataList[0].lng
            })
          } else {
            that.setData({
              showTopTip: false
            })
          }
          //请求最新情报后更新map高度
          that.changeMapHeight();
        }else{
          that.setData({
            showTopTip: false
          })
        }
      },
      fail: function (res) {
        that.showModal(res.data.msg);
      }
    })
  },

  /**
   * 点击顶部横幅提示
   */
  showNewMarkerClick: function () {
    var that = this;
    that.setData({
      longitude: that.data.lastNewMarkerLng,
      latitude: that.data.lastNewMarkerLat,
      currentMarkerId: that.data.lastNewMarkerId
    })
    that.requestMarkerInfo();
    that.adjustViewStatus(false, false, true);
  },

  /**
   * 设置上传情报按钮的左边距
   */
  setHomeActionLeftDistance: function () {
    var that = this;
    wx.getSystemInfo({
      success: function (res) {
        windowHeight = res.windowHeight;
        windowWidth = res.windowWidth;
        //创建节点选择器
        var query = wx.createSelectorQuery();
        //选择id
        query.select('#home-action-wrapper').boundingClientRect()
        query.exec(function (res) {
          //res就是 所有标签为mjltest的元素的信息 的数组
          consoleUtil.log(res);
          that.setData({
            homeActionLeftDistance: ((windowWidth - res[0].width) / 2) + 'px'
          })
          consoleUtil.log('homeActionLeftDistance------>' + that.data.homeActionLeftDistance);
        })
      }
    })
  },

  userLogin: function () {
    wx.login({
      success: res => {
        //var that = this;
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          app.globalData.code = res.code
          console.log(app.globalData.userInfo)
          if (app.globalData.userInfo) {
            var avatarUrl = app.globalData.userInfo.avatarUrl;
            var nickname = app.globalData.userInfo.nickName;
            var gender = app.globalData.userInfo.gender
          } else {
            var avatarUrl = '';
            var nickname = '';
            var gender = 0;
          }
          //console.log(res.code)
          //发起网络请求
          wx.request({
            url: API.obtainUrl(API.loginUrl),
            data: {
              wx_code: res.code,
              avatar: avatarUrl,
              nickname: nickname,
              gender: gender
            },
            header: {
              'content-type': 'application/json'
            },
            success: res => {
              console.log(res.data.data)
              if (res.data.code == 1000) {
                consoleUtil.log('sessionid---------------->' + res.data.data.session_id);
                app.globalData.header.Cookie = 'sessionid=' + res.data.data.session_id;
                app.globalData.checkStaus = res.data.data.status;
              } else if (res.data.code == 2001) {
                app.globalData.header.Cookie = 'sessionid=' + res.data.data.session_id;
              }
            },
            fail: res => {
              wx.showModal({
                title: '提示',
                content: '网络错误',
                showCancel: false,
              })
            }
          })
        } else {
          console.log('获取用户登录态失败！' + res.errMsg)
        }
      }
    })
  },

  changeMapHeight: function () {
    var that = this;
    var count = 0;
    wx.getSystemInfo({
      success: function (res) {
        consoleUtil.log(res);
        windowHeight = res.windowHeight;
        windowWidth = res.windowWidth;
        //创建节点选择器
        var query = wx.createSelectorQuery();
        //选择id
        query.select('#top-tips').boundingClientRect()
        query.exec(function (res) {
          //res就是 所有标签为mjltest的元素的信息 的数组
          consoleUtil.log(res);
          count += 1;
          if (that.data.showTopTip) {
            topHeight = res[0].height;
            that.setMapHeight(count);
          }
        })

        var query = wx.createSelectorQuery();
        query.select('#bottom-layout').boundingClientRect()
        query.exec(function (res) {
          consoleUtil.log(res);
          bottomHeight = res[0].height;
          count += 1;
          that.setMapHeight(count);
        })
      },
    })
  },

  setMapHeight: function (params) {
    var that = this;
    if (params == 2) {
      that.setData({
        mapHeight: (windowHeight - topHeight - bottomHeight) + 'px'
      })
      consoleUtil.log('mapHeight------------>' + that.data.mapHeight);
    }
    var controlsWidth = 40;
    var controlsHeight = 48;
    //设置中间部分指针
    that.setData({
      controls: [{
        id: 1,
        iconPath: '../../img/center-location.png',
        position: {
          left: (windowWidth - controlsWidth) / 2,
          top: (windowHeight - topHeight - bottomHeight) / 2 - controlsHeight * 3 / 4,
          width: controlsWidth,
          height: controlsHeight
        },
        clickable: true
      }]
    })
  },

  scopeSetting: function () {
    var that = this;
    wx.getSetting({
      success(res) {
        //地理位置
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success(res) {
              that.initMap();
            },
            fail() {
              wx.showModal({
                title: '提示',
                content: '定位失败，你未开启定位权限，点击开启定位权限',
                success: function (res) {
                  if (res.confirm) {
                    wx.openSetting({
                      success: function (res) {
                        if (res.authSetting['scope.userLocation']) {
                          that.initMap();
                        } else {
                          consoleUtil.log('用户未同意地理位置权限')
                        }
                      }
                    })
                  }
                }
              })
            }
          })
        } else {
          that.initMap();
        }
      }
    })
  },

  /** 
   * 初始化地图
   */
  initMap: function () {
    var that = this;
    console.log(constant.tencentAk);
    qqmapsdk = new QQMapWX({
      key: constant.tencentAk
    });
    that.getCenterLocation();
  },

  //请求地理位置
  requestLocation: function () {
    consoleUtil.log('requestLocation----------->请求地理位置')
    var that = this;
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        //第一次加载，如果是分享链接点入，需要跳转到指定marker
        if (that.data.showShare) {
          that.setData({
            showShare: false,
            longitude: that.data.shareLongitude,
            latitude: that.data.shareLatitude
          })
          that.adjustViewStatus(false, false, true);
          that.requestMarkerInfo();
        } else {
          that.setData({
            latitude: res.latitude,
            longitude: res.longitude,
          })
        }
      },
    })
  },

  /**
   * 点击marker
   */
  bindMakertap: function (e) {
    consoleUtil.log('点击了marker');
    consoleUtil.log(e);
    var that = this;
    //设置当前点击的id
    that.setData({
      currentMarkerId: e.markerId
    })
    that.adjustViewStatus(false, false, true);
    that.requestMarkerInfo();
    //重新设置点击marker为中心点
    for (var key in that.data.markers) {
      var marker = that.data.markers[key];
      if (e.markerId == marker.id) {
        that.setData({
          longitude: marker.longitude,
          latitude: marker.latitude,
        })
      }
    }
  },

  /**
   * 请求marker点情报信息
   */
  requestMarkerInfo: function () {
    var that = this;
    wx.request({
      url: API.obtainUrl(API.queryCommentUrl),
      header: app.globalData.header,
      data: {
        info_id: that.data.currentMarkerId
      },
      success: function (res) {
        if (res.data.code == 1000) {
          var dataBean = res.data.data;
          var info = dataBean.info;
          that.setData({
            warningIconUrl: info.image,
            infoMessage: info.message,
            infoAddress: info.address,
            praiseSrc: info.isUp ? '../../img/praise.png' : '../../img/bottom-unpraise.png',
            praiseCount: info.up,
            commentList: dataBean.comment,
            isUp: info.isUp ? 1 : 0,
            currentTipInfo: info.message,
          })
        }
      },
      fail: function (res) {
        wx.showModal({
          title: '提示',
          content: res.data.msg,
          showCancel: false
        });
      }
    })
  },

  /**
   * 改变选中的 marker 的样式
   */
  changeMarkerStyle: function () {
    consoleUtil.log('changeMarkerStyle------------>');
    var that = this;
    var markerList = that.data.markers;
    for (var key in markerList) {
      var marker = markerList[key];
      if (marker.id == that.data.currentMarkerId) {
        marker.width = 80;
        marker.height = 80;
        marker.iconPath = '../../img/dog-select.png';
      }
    }
    that.setData({
      markers: markerList
    })
  },

  /**
   * 重置选中 marker 的样式
   */
  resetMarkerStyle: function () {
    var that = this;
    var markerList = that.data.markers;
    for (var key in markerList) {
      var marker = markerList[key];
      if (marker.id == that.data.currentMarkerId) {
        marker.width = 40;
        marker.height = 40;
        marker.iconPath = '../../img/dog-yellow.png';
      }
    }
    that.setData({
      markers: markerList
    })
  },

  /**
   * 上传情报
   */
  uploadInfoClick: function () {
    var that = this;
    that.adjustViewStatus(false, true, false);
    that.updateCenterLocation(that.data.latitude, that.data.longitude);
    that.regeocodingAddress();
  },

  /**
   * 更新上传坐标点
   */
  updateCenterLocation: function (latitude, longitude) {
    var that = this;
    that.setData({
      centerLatitude: latitude,
      centerLongitude: longitude
    })
  },

  /**
   * 回到定位点
   */
  selfLocationClick: function () {
    consoleUtil.log('selfLocationClick--------------->');
    var that = this;
    //必须请求定位，不然有时候会回不到当前位置
    that.requestLocation();
    that.moveTolocation();
  },

  /**
   * 移动到中心点
   */
  moveTolocation: function () {
    var mapCtx = wx.createMapContext(mapId);
    mapCtx.moveToLocation();
  },

  cancelClick: function () {
    var that = this;
    that.resetPhoto();
    that.adjustViewStatus(true, false, false);
  },

  /**
   * 确认上传情报
   */
  confirmClick: function (res) {
    var that = this;
    consoleUtil.log(res);
    var message = res.detail.value.message.trim();
    if (!that.data.centerLatitude || !that.data.centerLongitude) {
      wx.showModal({
        title: '提示',
        content: '请选择上传地点~',
        showCancel: false,
      })
      return;
    }
    if (!message) {
      wx.showModal({
        title: '提示',
        content: '请说点什么吧~',
        showCancel: false,
      })
      return;
    }
    //成功
    var success = function (res) {
      consoleUtil.log(res.data);
      var data = res.data;
      if (typeof (data) == 'string') {
        data = JSON.parse(data);
      }
      consoleUtil.log(data);
      if (data.code == 1000) {
        wx.showModal({
          title: '提示',
          content: '上传成功',
          showCancel: false
        });
        that.resetPhoto();
        that.adjustViewStatus(true, false, false);
      } else {
        wx.showModal({
          title: '提示',
          content: res.data.msg,
          showCancel: false
        });
      }
    }
    var fail = function (res) {
      wx.showModal({
        title: '提示',
        content: res.data.msg,
        showCancel: false
      });
    }

    var complete = function (res) {
      wx.hideLoading();
    }
    wx.showLoading({
      title: '提交中...',
    })
    //设置需要上传的经纬度(如果有回调的地址，则使用回调的经纬度,否则使用中心点坐标)
    var lat;
    var lng;
    consoleUtil.log('confirmClick-------------------->');
    consoleUtil.log(that.data.callbackLocation);
    if (that.data.callbackLocation != null) {
      lat = that.data.callbackLocation.lat;
      lng = that.data.callbackLocation.lng;
    } else {
      lat = that.data.centerLatitude;
      lng = that.data.centerLongitude;
    }
    consoleUtil.log('lat----->' + lat + '---lng----->' + lng);
    //如果上传了图片使用 uploadFile，否则使用 request
    var uploadData = {
      lat: lat,
      lng: lng,
      address: that.data.selectAddress,
      message: message,
      province: that.data.currentProvince,
      city: that.data.currentCity,
      district: that.data.currentDistrict,
    }
    if (that.data.uploadImagePath) {
      wx.uploadFile({
        url: API.obtainUrl(API.uploadInfoUrl),
        header: app.globalData.header,
        filePath: that.data.uploadImagePath,
        name: 'image',
        formData: uploadData,
        success: success,
        fail: fail,
        complete: complete
      })
    } else {
      wx.request({
        url: API.obtainUrl(API.uploadInfoUrl),
        header: app.globalData.header,
        data: uploadData,
        success: success,
        fail: fail,
        complete: complete
      })
    }
  },

  /**
   * 点击控件时触发
   */
  controlTap: function () {

  },

  /**
   * 点击地图时触发
   */
  bindMapTap: function () {
    consoleUtil.log('bindMapTap------------------->>');
    //恢复到原始页
    this.adjustViewStatus(true, false, false);
  },

  /**
   * 关闭评论 退出当前 marker 显示
   */
  colseCommentClick: function () {
    var that = this;
    that.adjustViewStatus(true, false, false);
    that.resetMarkerStyle();
  },

  adjustViewStatus: function (uploadStatus, confirmStatus, commentStatus) {
    var that = this;
    that.setData({
      //显示上传情报按钮
      showUpload: uploadStatus,
      //开始上传情报
      showConfirm: confirmStatus,
      //显示情报详情
      showComment: commentStatus,
    })
    that.changeMapHeight();
  },

  /**
   * 点赞
   */
  praiseClick: function () {
    var that = this;
    if (that.data.isUp == 1) {
      return;
    }
    wx.request({
      url: API.obtainUrl(API.likeUrl),
      header: app.globalData.header,
      data: {
        info_id: that.data.currentMarkerId
      },
      success: function (res) {
        if (res.data.code == 1000) {
          that.setData({
            praiseSrc: '../../img/praise.png',
            isUp: 1,
            praiseCount: that.data.praiseCount + 1
          })
        } else {
          that.showModal(res.data.msg);
        }
      },
      fail: function (res) {
        that.showModal(res.data.msg);
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

  /**
   * 自定义分享
   */
  onShareAppMessage: function (res) {
    var that = this;
    //按钮表示已经获取了情报信息，是分享的单个情报
    if (res.from === 'button') {
      return {
        title: that.data.currentTipInfo,
        //携带 markerId
        path: 'pages/index/index?shareMarkerId=' + that.data.currentMarkerId + '&shareLng=' + that.data.longitude + '&shareLat=' + that.data.latitude
      }
    }
  },

  /**
   * 预览图片
   */
  previewImage: function () {
    var that = this;
    wx.previewImage({
      urls: [that.data.warningIconUrl],
    })
  },

  /**
   * 选择照片
   */
  takePhoto: function () {
    var that = this;
    wx.chooseImage({
      sizeType: sizeType[1],
      count: 1,
      success: function (res) {
        that.setData({
          uploadImagePath: res.tempFilePaths[0],
        })
        that.adjustViewStatus(false, true, false);
      },
    })
  },

  /**
   * 删除已选照片
   */
  deleteSelectImage: function () {
    this.resetPhoto();
  },

  /**
   * 重置照片
   */
  resetPhoto: function () {
    var that = this;
    that.setData({
      uploadImagePath: '',
    })
  },

  previewSelectImage: function () {
    var that = this;
    wx.previewImage({
      urls: [that.data.uploadImagePath],
    })
  },

  /**
   * 拖动地图回调
   */
  regionChange: function (res) {
    var that = this;
    // 改变中心点位置  
    if (res.type == "end") {
      that.getCenterLocation();
    }
  },

  /**
   * 得到中心点坐标
   */
  getCenterLocation: function () {
    var that = this;
    var mapCtx = wx.createMapContext(mapId);
    mapCtx.getCenterLocation({
      success: function (res) {
        console.log('getCenterLocation----------------------->');
        console.log(res);
        that.updateCenterLocation(res.latitude, res.longitude);
        that.regeocodingAddress();
        that.queryMarkerInfo();
        //请求最新情报信息
        that.queryNewInfo(res.latitude, res.longitude);
        //第二次把回调的定位数据也置空
        if (that.data.callbackAddressInfo == null && that.data.callbackLocation != null) {
          that.setData({
            callbackLocation: null
          })
        }
      }
    })
  },

  /**
   * 逆地址解析
   */
  regeocodingAddress: function () {
    var that = this;
    //通过经纬度解析地址
    qqmapsdk.reverseGeocoder({
      location: {
        latitude: that.data.centerLatitude,
        longitude: that.data.centerLongitude
      },
      success: function (res) {
        console.log(res);
        that.setData({
          centerAddressBean: res.result,
          selectAddress: res.result.formatted_addresses.recommend,
          currentProvince: res.result.address_component.province,
          currentCity: res.result.address_component.city,
          currentDistrict: res.result.address_component.district,
        })
      },
      fail: function (res) {
        console.log(res);
      }
    });
  },

  /**
   * 查询情报信息
   */
  queryMarkerInfo: function () {
    var that = this;
    wx.request({
      url: API.obtainUrl(API.queryInfoUrl),
      header: app.globalData.header,
      data: {
        lat: that.data.centerLatitude,
        lng: that.data.centerLongitude,
      },
      success: function (res) {
        if (res.data.code == 1000) {
          that.createMarker(res.data);
        }
      },
      fail: function (res) {
        wx.showModal({
          title: '提示',
          content: res.data.msg,
          showCancel: false
        });
      }
    })
  },

  /**
   * 创建marker
   */
  createMarker: function (dataList) {
    var that = this;
    var currentMarker = [];
    var markerList = dataList.data;
    for (var key in markerList) {
      var marker = markerList[key];
      marker.id = marker.info_id;
      marker.latitude = marker.lat;
      marker.longitude = marker.lng;
      marker.width = 40;
      marker.height = 40;
      if (marker.image) {
        marker.iconPath = '../../img/dog-select.png';
      } else {
        marker.iconPath = '../../img/dog-yellow.png';
      }
    }
    currentMarker = currentMarker.concat(markerList);
    consoleUtil.log('-----------------------');
    consoleUtil.log(currentMarker);
    that.setData({
      markers: currentMarker
    })
  },

  /**
   * 选择地址
   */
  chooseAddress: function () {
    var that = this;
    wx.navigateTo({
      url: '../chooseAddress/chooseAddress?city=' + that.data.centerAddressBean.address_component.city + '&street=' + that.data.centerAddressBean.address_component.street,
    })
  },

  /**
   * 点击跳转评论页面
   */
  commentClick: function () {
    var that = this;
    that.setData({
      showCommentInput: true
    })
    // wx.navigateTo({
    //   url: '../comment/comment?currentMarkerId=' + that.data.currentMarkerId,
    // })
  },

  /**
   * 输入框失去焦点时
   */
  bingblurComment: function (res) {
    consoleUtil.log('bingblurComment--------------->');
    consoleUtil.log(res);
    var that = this;
    that.setData({
      showCommentInput: false
    })
  },

  /**
   * 监听输入
   */
  subscribeCommentInput: function (e) {
    this.setData({
      commentMessage: e.detail.value
    })
  },

  /**
   * 发送评论
   */
  submitComment: function () {
    consoleUtil.log('submitComment----------->')
    var that = this;
    if (!that.data.commentMessage) {
      that.showModal('请写点什么吧~');
      return;
    }
    wx.showLoading({
      title: '发表中...',
    });
    wx.request({
      url: API.obtainUrl(API.uploadCommentUrl),
      header: app.globalData.header,
      data: {
        info_id: that.data.currentMarkerId,
        message: that.data.commentMessage
      },
      success: function (res) {
        if (res.data.code == 1000) {
          //评论成功
          that.setData({
            showCommentInput: false,
            commentMessage: ''
          })
          //重新请求marker信息
          that.requestMarkerInfo();
        } else {
          that.showModal(res.data.msg);
        }
      },
      fail: function (res) {
        that.showModal(res.data.msg);
      },
      complete: function () {
        wx.hideLoading();
      }
    })
  },

  /**
   * 完全展示情报文字
   */
  showTotalTipInfo: function () {
    var that = this;
    wx.showModal({
      title: '情报',
      content: that.data.currentTipInfo,
      showCancel: false,
    })
  },

  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  }
})
