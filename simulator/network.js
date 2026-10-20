(function(root){
'use strict';
// Station identity and PDF registration. Display uses complete sheets.
const catalog={
  "cheongnyangni": {
    "id": "cheongnyangni",
    "name": "청량리",
    "order": 0,
    "controlled": true,
    "slide": 2,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 2",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010000",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        0,
        0,
        520,
        260
      ],
      "modes": [
        {
          "x": 89.956,
          "y": 44.444
        },
        {
          "x": 118.4,
          "y": 44.444
        },
        {
          "x": 146.844,
          "y": 44.444
        }
      ]
    }
  },
  "jegidong": {
    "id": "jegidong",
    "name": "제기동",
    "order": 1,
    "controlled": false,
    "slide": 2,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 2"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "sinseoldong": {
    "id": "sinseoldong",
    "name": "신설동",
    "order": 2,
    "controlled": false,
    "slide": 3,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "dongmyo": {
    "id": "dongmyo",
    "name": "동묘앞",
    "order": 3,
    "controlled": true,
    "slide": 3,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010010",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        510,
        0,
        550,
        260
      ],
      "modes": [
        {
          "x": 589.289,
          "y": 44.444
        },
        {
          "x": 617.733,
          "y": 44.444
        },
        {
          "x": 646.178,
          "y": 44.444
        }
      ]
    }
  },
  "dongdaemun": {
    "id": "dongdaemun",
    "name": "동대문",
    "order": 4,
    "controlled": false,
    "slide": 3,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "jongno5": {
    "id": "jongno5",
    "name": "종로5가",
    "order": 5,
    "controlled": false,
    "slide": 3,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "jongno3": {
    "id": "jongno3",
    "name": "종로3가",
    "order": 6,
    "controlled": false,
    "slide": 3,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "jonggak": {
    "id": "jonggak",
    "name": "종각",
    "order": 7,
    "controlled": true,
    "slide": 4,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 4",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010020",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        1060,
        0,
        525,
        260
      ],
      "modes": [
        {
          "x": 1088.8,
          "y": 44.089
        },
        {
          "x": 1116.889,
          "y": 44.089
        },
        {
          "x": 1145.689,
          "y": 44.089
        }
      ]
    }
  },
  "cityhall": {
    "id": "cityhall",
    "name": "시청",
    "order": 8,
    "controlled": false,
    "slide": 4,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 4"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "underground-seoul": {
    "id": "underground-seoul",
    "name": "지하서울",
    "order": 9,
    "controlled": true,
    "slide": 5,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 5",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010030",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        1580,
        0,
        468,
        260
      ],
      "modes": [
        {
          "x": 1679.2,
          "y": 44.089
        },
        {
          "x": 1707.289,
          "y": 44.089
        },
        {
          "x": 1735.733,
          "y": 44.089
        }
      ]
    }
  },
  "seoul": {
    "id": "seoul",
    "name": "서울",
    "order": 10,
    "controlled": true,
    "slide": 6,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 6",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010040",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        0,
        280,
        570,
        380
      ],
      "modes": [
        {
          "x": 92.8,
          "y": 312.356
        },
        {
          "x": 121.244,
          "y": 312.356
        },
        {
          "x": 149.689,
          "y": 312.356
        }
      ]
    }
  },
  "namyeong": {
    "id": "namyeong",
    "name": "남영",
    "order": 11,
    "controlled": false,
    "slide": 6,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 6"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "yongsan": {
    "id": "yongsan",
    "name": "용산",
    "order": 12,
    "controlled": true,
    "slide": 7,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 7",
      "display": "1.전체노선.pdf · PDF 2쪽"
    },
    "code": "010050",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 2,
      "referenceWindow": [
        500,
        280,
        760,
        380
      ],
      "modes": [
        {
          "x": 585,
          "y": 312.293
        },
        {
          "x": 613.581,
          "y": 312.293
        },
        {
          "x": 642.162,
          "y": 312.293
        }
      ]
    }
  },
  "noryangjin": {
    "id": "noryangjin",
    "name": "노량진",
    "order": 13,
    "controlled": true,
    "slide": 8,
    "image": "assets/line-map/page-4.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 8",
      "display": "1.전체노선.pdf · PDF 4쪽"
    },
    "code": "010060",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 4,
      "referenceWindow": [
        0,
        200,
        540,
        340
      ],
      "modes": [
        {
          "x": 12.8,
          "y": 233.422
        },
        {
          "x": 40.533,
          "y": 233.422
        },
        {
          "x": 68.978,
          "y": 233.422
        }
      ]
    }
  },
  "daebang": {
    "id": "daebang",
    "name": "대방",
    "order": 14,
    "controlled": false,
    "slide": 8,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 8"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "singil": {
    "id": "singil",
    "name": "신길",
    "order": 15,
    "controlled": false,
    "slide": 8,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 8"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "yeongdeungpo": {
    "id": "yeongdeungpo",
    "name": "영등포",
    "order": 16,
    "controlled": true,
    "slide": 9,
    "image": "assets/line-map/page-4.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 9",
      "display": "1.전체노선.pdf · PDF 4쪽"
    },
    "code": "010070",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 4,
      "referenceWindow": [
        420,
        200,
        750,
        340
      ],
      "modes": [
        {
          "x": 535.336,
          "y": 233.685
        },
        {
          "x": 563.529,
          "y": 233.685
        },
        {
          "x": 592.455,
          "y": 233.685
        }
      ]
    }
  },
  "sindorim": {
    "id": "sindorim",
    "name": "신도림",
    "order": 17,
    "controlled": false,
    "slide": 9,
    "image": "assets/line-map/page-2.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 9"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "guro": {
    "id": "guro",
    "name": "구로",
    "order": 18,
    "controlled": true,
    "slide": 10,
    "image": "assets/line-map/page-4.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 10",
      "display": "1.전체노선.pdf · PDF 4쪽"
    },
    "code": "010080",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 4,
      "referenceWindow": [
        900,
        195,
        620,
        340
      ],
      "modes": [
        {
          "x": 930.578,
          "y": 234.111
        },
        {
          "x": 959.022,
          "y": 234.111
        },
        {
          "x": 987.467,
          "y": 234.111
        }
      ]
    }
  },
  "gasan": {
    "id": "gasan",
    "name": "가산디지털",
    "order": 19,
    "controlled": false,
    "slide": 10,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 10"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "doksan": {
    "id": "doksan",
    "name": "독산",
    "order": 20,
    "controlled": false,
    "slide": 10,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 10"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "geumcheon": {
    "id": "geumcheon",
    "name": "금천구청",
    "order": 21,
    "controlled": true,
    "slide": 11,
    "image": "assets/line-map/page-4.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 11",
      "display": "1.전체노선.pdf · PDF 4쪽"
    },
    "code": "010090",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 4,
      "referenceWindow": [
        1420,
        195,
        628,
        340
      ],
      "modes": [
        {
          "x": 1466.222,
          "y": 234.467
        },
        {
          "x": 1494.667,
          "y": 234.467
        },
        {
          "x": 1523.111,
          "y": 234.467
        }
      ]
    }
  },
  "seoksu": {
    "id": "seoksu",
    "name": "석수",
    "order": 22,
    "controlled": false,
    "slide": 11,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 11"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "gwanak": {
    "id": "gwanak",
    "name": "관악",
    "order": 23,
    "controlled": false,
    "slide": 12,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 12"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "anyang": {
    "id": "anyang",
    "name": "안양",
    "order": 24,
    "controlled": true,
    "slide": 12,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 12",
      "display": "1.전체노선.pdf · PDF 3쪽"
    },
    "code": "010100",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 3,
      "referenceWindow": [
        1230,
        0,
        465,
        280
      ],
      "modes": [
        {
          "x": 1296.489,
          "y": 56.533
        },
        {
          "x": 1324.933,
          "y": 56.533
        },
        {
          "x": 1353.378,
          "y": 56.533
        }
      ]
    }
  },
  "myeonghak": {
    "id": "myeonghak",
    "name": "명학",
    "order": 25,
    "controlled": false,
    "slide": 13,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 13"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "geumjeong": {
    "id": "geumjeong",
    "name": "금정",
    "order": 26,
    "controlled": true,
    "slide": 14,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 14",
      "display": "1.전체노선.pdf · PDF 3쪽"
    },
    "code": "010110",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 3,
      "referenceWindow": [
        1670,
        0,
        378,
        280
      ],
      "modes": [
        {
          "x": 1712.311,
          "y": 57.956
        },
        {
          "x": 1740.756,
          "y": 57.956
        },
        {
          "x": 1769.2,
          "y": 57.956
        }
      ]
    }
  },
  "gunpo": {
    "id": "gunpo",
    "name": "군포",
    "order": 27,
    "controlled": true,
    "slide": 15,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 15",
      "display": "1.전체노선.pdf · PDF 3쪽"
    },
    "code": "010120",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 3,
      "referenceWindow": [
        0,
        390,
        470,
        310
      ],
      "modes": [
        {
          "x": 23.111,
          "y": 434.8
        },
        {
          "x": 51.556,
          "y": 434.8
        },
        {
          "x": 80,
          "y": 434.8
        }
      ]
    }
  },
  "dangjeong": {
    "id": "dangjeong",
    "name": "당정",
    "order": 28,
    "controlled": false,
    "slide": 16,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 16"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "uiwang": {
    "id": "uiwang",
    "name": "의왕",
    "order": 29,
    "controlled": true,
    "slide": 17,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 17",
      "display": "1.전체노선.pdf · PDF 3쪽"
    },
    "code": "010130",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 3,
      "referenceWindow": [
        450,
        390,
        720,
        310
      ],
      "modes": [
        {
          "x": 552.044,
          "y": 436.578
        },
        {
          "x": 580.489,
          "y": 436.578
        },
        {
          "x": 608.933,
          "y": 436.578
        }
      ]
    }
  },
  "skku": {
    "id": "skku",
    "name": "성균관대",
    "order": 30,
    "controlled": false,
    "slide": 18,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 18"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "hwaseo": {
    "id": "hwaseo",
    "name": "화서",
    "order": 31,
    "controlled": false,
    "slide": 18,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 18"
    },
    "code": "—",
    "routes": {},
    "points": {},
    "signals": {}
  },
  "suwon": {
    "id": "suwon",
    "name": "수원",
    "order": 32,
    "controlled": true,
    "slide": 19,
    "image": "assets/line-map/page-3.jpg",
    "width": 2048,
    "height": 768,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 19",
      "display": "1.전체노선.pdf · PDF 3쪽"
    },
    "code": "010140",
    "routes": {},
    "points": {},
    "signals": {},
    "map": {
      "page": 3,
      "referenceWindow": [
        1090,
        390,
        500,
        310
      ],
      "modes": [
        {
          "x": 1156.844,
          "y": 434.8
        },
        {
          "x": 1185.289,
          "y": 434.8
        },
        {
          "x": 1213.733,
          "y": 434.8
        }
      ]
    }
  }
};
const stations=Object.values(catalog).sort((a,b)=>a.order-b.order);
const api={catalog,stations};
const wiring=typeof module!=='undefined'?require('./wiring.js'):root.SimWiring;
wiring.apply(api);
if(typeof module!=='undefined')module.exports=api;else root.SimNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
