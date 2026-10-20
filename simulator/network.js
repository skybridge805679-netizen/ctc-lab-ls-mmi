(function(root){
'use strict';
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M230 512H1000",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 2"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2A-2T": {
        "signal": "2A",
        "pathTracks": [
          "2A",
          "2T"
        ],
        "path": "M1390 620H710",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 2"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 190,
        "y": 492,
        "kind": "장내"
      },
      "2A": {
        "x": 1435,
        "y": 641,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010000",
    "modeX": [
      178,
      297,
      419
    ],
    "modeY": 68,
    "map": {
      "page": 2,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 103.111,
          "y": 127.644
        },
        "2A": {
          "x": 389.689,
          "y": 178.489
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1B-1T": {
        "signal": "1B",
        "pathTracks": [
          "1B",
          "1T"
        ],
        "path": "M470 512H910",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 3"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2A-2T": {
        "signal": "2A",
        "pathTracks": [
          "2A",
          "2T"
        ],
        "path": "M995 620H740",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 3"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "3A-B015T": {
        "signal": "3A",
        "pathTracks": [
          "3A",
          "B015T"
        ],
        "path": "M690 620H460",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 3"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1B": {
        "x": 430,
        "y": 496,
        "kind": "장내"
      },
      "2A": {
        "x": 1040,
        "y": 641,
        "kind": "장내"
      },
      "3A": {
        "x": 730,
        "y": 641,
        "kind": "출발"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010010",
    "modeX": [
      209,
      328,
      448
    ],
    "modeY": 68,
    "map": {
      "page": 2,
      "focus": [
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
      ],
      "signals": {
        "1B": {
          "x": 615.6,
          "y": 127.289
        },
        "2A": {
          "x": 772.044,
          "y": 177.067
        },
        "3A": {
          "x": 705.556,
          "y": 177.067
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M580 512H800",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 4"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2A-2T": {
        "signal": "2A",
        "pathTracks": [
          "2A",
          "2T"
        ],
        "path": "M1060 619H640",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 4"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "3A-B043T": {
        "signal": "3A",
        "pathTracks": [
          "3A",
          "B043T"
        ],
        "path": "M595 619H445",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 4"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 540,
        "y": 493,
        "kind": "장내"
      },
      "2A": {
        "x": 1100,
        "y": 638,
        "kind": "장내"
      },
      "3A": {
        "x": 635,
        "y": 638,
        "kind": "출발"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010020",
    "modeX": [
      227,
      346,
      467
    ],
    "modeY": 68,
    "map": {
      "page": 2,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1207.2,
          "y": 128.0
        },
        "2A": {
          "x": 1389.6,
          "y": 177.067
        },
        "3A": {
          "x": 1218.578,
          "y": 177.067
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010030",
    "modeX": [
      226,
      345,
      467
    ],
    "modeY": 67,
    "map": {
      "page": 2,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1724.711,
          "y": 128.0
        },
        "2A": {
          "x": 1994.933,
          "y": 177.067
        },
        "3A": {
          "x": 1803.289,
          "y": 177.067
        },
        "4A": {
          "x": 1882.222,
          "y": 128.0
        },
        "21": {
          "x": 1722.578,
          "y": 164.622
        },
        "22": {
          "x": 1804.711,
          "y": 182.756
        },
        "23": {
          "x": 1804.711,
          "y": 140.089
        },
        "51": {
          "x": 1962.578,
          "y": 158.578
        },
        "52": {
          "x": 1880.444,
          "y": 122.667
        },
        "53": {
          "x": 1880.444,
          "y": 164.622
        }
      },
      "points": {
        "21": {
          "x": 1774.844,
          "y": 127.289
        },
        "22": {
          "x": 1788.0,
          "y": 127.289
        },
        "51": {
          "x": 1929.867,
          "y": 158.222
        },
        "52": {
          "x": 1904.622,
          "y": 177.067
        }
      },
      "paths": {
        "1A-1T": "M1721 134.8H1879",
        "2A-2T": "M1998 170.7H1807",
        "3A-B065T": "M1807 170.7H1691",
        "3A-B070T": "M1807 170.7H1788L1776 134.8H1691",
        "4A-B072T": "M1879 134.8H2036"
      },
      "labels": {
        "B065T": {
          "x": 1706.578,
          "y": 172.8
        },
        "X1T": {
          "x": 1736.8,
          "y": 172.8
        },
        "21BT": {
          "x": 1763.822,
          "y": 172.8
        },
        "XT": {
          "x": 1736.8,
          "y": 136.533
        },
        "21AT": {
          "x": 1763.822,
          "y": 136.533
        },
        "1T": {
          "x": 1865.867,
          "y": 136.533
        },
        "YT": {
          "x": 1973.956,
          "y": 172.8
        },
        "52T": {
          "x": 1936.978,
          "y": 172.8
        },
        "2T": {
          "x": 1865.867,
          "y": 172.8
        },
        "B070T": {
          "x": 1706.578,
          "y": 136.533
        },
        "51BT": {
          "x": 1901.422,
          "y": 136.533
        },
        "Y1T": {
          "x": 1981.067,
          "y": 136.533
        },
        "B072T": {
          "x": 2015.556,
          "y": 136.533
        }
      }
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M180 276H490",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 6"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-2T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "2T"
        ],
        "path": "M920 330H490",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 6"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 145,
        "y": 255,
        "kind": "장내"
      },
      "2B": {
        "x": 960,
        "y": 347,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010040",
    "modeX": [
      226,
      345,
      467
    ],
    "modeY": 68,
    "map": {
      "page": 2,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 77.511,
          "y": 395.556
        },
        "2B": {
          "x": 262.756,
          "y": 426.489
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M285 440H1150",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 7"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-2T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "2T"
        ],
        "path": "M1440 495H940",
        "source": [
          "1.전체노선.pdf · PDF 2쪽",
          "배선도(관제교육장).pptx · 슬라이드 7"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 250,
        "y": 421,
        "kind": "장내"
      },
      "2B": {
        "x": 1480,
        "y": 512,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010050",
    "modeX": [
      214,
      334,
      454
    ],
    "modeY": 77,
    "map": {
      "page": 2,
      "focus": [
        500,
        280,
        760,
        380
      ],
      "modes": [
        {
          "x": 585.0,
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
      ],
      "signals": {
        "1A": {
          "x": 580.175,
          "y": 450.372
        },
        "2B": {
          "x": 864.128,
          "y": 481.18
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M240 439H780",
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 8"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-2T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "2T"
        ],
        "path": "M980 494H550",
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 8"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 205,
        "y": 421,
        "kind": "장내"
      },
      "2B": {
        "x": 1020,
        "y": 514,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010060",
    "modeX": [
      226,
      345,
      467
    ],
    "modeY": 72,
    "map": {
      "page": 4,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 81.422,
          "y": 331.2
        },
        "2B": {
          "x": 261.333,
          "y": 362.489
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 9"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-3T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "3T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 9"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 235,
        "y": 341,
        "kind": "장내"
      },
      "2B": {
        "x": 1490,
        "y": 421,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010070",
    "modeX": [
      216,
      337,
      458
    ],
    "modeY": 62,
    "map": {
      "page": 4,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 541.56,
          "y": 319.364
        },
        "2B": {
          "x": 847.658,
          "y": 350.852
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M440 360H745",
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 10"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-2T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "2T"
        ],
        "path": "M1195 405H750",
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 10"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-5T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "5T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 10",
          "비상시조치 대본 05 · 단계14"
        ],
        "evidence": "대본 진로표기 확인 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 400,
        "y": 344,
        "kind": "장내"
      },
      "2B": {
        "x": 1235,
        "y": 423,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010080",
    "modeX": [
      220,
      340,
      461
    ],
    "modeY": 60,
    "map": {
      "page": 4,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1022.667,
          "y": 320.156
        },
        "2B": {
          "x": 1256.267,
          "y": 350.378
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 11"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-5T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "5T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 11",
          "비상시조치 대본 03 · 단계22 / 05 · 단계14"
        ],
        "evidence": "대본 진로표기 확인 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "3B-B639T": {
        "signal": "3B",
        "pathTracks": [
          "3B",
          "B639T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 4쪽",
          "배선도(관제교육장).pptx · 슬라이드 11",
          "비상시조치 대본 05 · 단계14"
        ],
        "evidence": "대본 진로표기 확인 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 100,
        "y": 294,
        "kind": "장내"
      },
      "2B": {
        "x": 1250,
        "y": 390,
        "kind": "장내"
      },
      "3B": {
        "x": 490,
        "y": 469,
        "kind": "출발"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010090",
    "modeX": [
      233,
      351,
      470
    ],
    "modeY": 65,
    "map": {
      "page": 4,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1465.511,
          "y": 301.667
        },
        "2B": {
          "x": 1798.311,
          "y": 351.444
        },
        "3B": {
          "x": 1598.489,
          "y": 368.867
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 12"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-4T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "4T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 12"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "3B-B655T": {
        "signal": "3B",
        "pathTracks": [
          "3B",
          "B655T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 12",
          "비상시조치 대본 03 · 단계22 / 06 · 단계20"
        ],
        "evidence": "대본 진로표기 확인 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 540,
        "y": 298,
        "kind": "장내"
      },
      "2B": {
        "x": 1800,
        "y": 427,
        "kind": "장내"
      },
      "3B": {
        "x": 1035,
        "y": 476,
        "kind": "출발"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010100",
    "modeX": [
      240,
      362,
      483
    ],
    "modeY": 65,
    "map": {
      "page": 3,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1323.156,
          "y": 144.356
        },
        "2B": {
          "x": 1611.511,
          "y": 195.2
        },
        "3B": {
          "x": 1432.311,
          "y": 212.978
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-2T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "2T"
        ],
        "path": "M375 312H1080",
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 14"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2A-3T": {
        "signal": "2A",
        "pathTracks": [
          "2A",
          "3T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 14"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 335,
        "y": 295,
        "kind": "장내"
      },
      "2A": {
        "x": 1520,
        "y": 469,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010110",
    "modeX": [
      224,
      345,
      466
    ],
    "modeY": 63,
    "map": {
      "page": 3,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1750.356,
          "y": 144.711
        },
        "2A": {
          "x": 1992.133,
          "y": 212.622
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {
      "1A-1T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "1T"
        ],
        "path": "M290 306H1045",
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 15"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2A-4T": {
        "signal": "2A",
        "pathTracks": [
          "2A",
          "4T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 15"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "1B-1T": {
        "signal": "1B",
        "pathTracks": [
          "1B",
          "1T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 15",
          "비상시조치 대본 04 · 단계17"
        ],
        "evidence": "대본 진로표기 확인 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 250,
        "y": 289,
        "kind": "장내"
      },
      "2A": {
        "x": 1620,
        "y": 461,
        "kind": "장내"
      },
      "1B": {
        "x": 250,
        "y": 334,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010120",
    "modeX": [
      233,
      354,
      475
    ],
    "modeY": 65,
    "map": {
      "page": 3,
      "focus": [
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
          "x": 80.0,
          "y": 434.8
        }
      ],
      "signals": {
        "1A": {
          "x": 60.089,
          "y": 522.978
        },
        "2A": {
          "x": 360.178,
          "y": 590.889
        },
        "1B": {
          "x": 60.089,
          "y": 540.756
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-2T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "2T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 17"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "2B-4T": {
        "signal": "2B",
        "pathTracks": [
          "2B",
          "4T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 17"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 230,
        "y": 326,
        "kind": "장내"
      },
      "2B": {
        "x": 1645,
        "y": 422,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 430,
        "y": 550,
        "draw": false
      },
      "51": {
        "parts": [
          "51"
        ],
        "x": 1300,
        "y": 550,
        "draw": false
      }
    },
    "code": "010130",
    "modeX": [
      254,
      374,
      495
    ],
    "modeY": 69,
    "map": {
      "page": 3,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 538.533,
          "y": 522.978
        },
        "2B": {
          "x": 869.556,
          "y": 573.467
        }
      },
      "points": {},
      "paths": {}
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {},
    "signals": {},
    "points": {},
    "code": "—"
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
    "routes": {
      "1A-3T": {
        "signal": "1A",
        "pathTracks": [
          "1A",
          "3T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 19"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      },
      "1B-4T": {
        "signal": "1B",
        "pathTracks": [
          "1B",
          "4T"
        ],
        "path": null,
        "source": [
          "1.전체노선.pdf · PDF 3쪽",
          "배선도(관제교육장).pptx · 슬라이드 19"
        ],
        "evidence": "배선 번호 기반 기본 경로 · 세부 연동 미검증",
        "switchConditions": null,
        "releaseSeconds": null
      }
    },
    "signals": {
      "1A": {
        "x": 185,
        "y": 290,
        "kind": "장내"
      },
      "1B": {
        "x": 180,
        "y": 334,
        "kind": "장내"
      }
    },
    "points": {
      "21": {
        "parts": [
          "21"
        ],
        "x": 0,
        "y": 0,
        "draw": false
      },
      "22": {
        "parts": [
          "22"
        ],
        "x": 0,
        "y": 0,
        "draw": false
      },
      "32": {
        "parts": [
          "32"
        ],
        "x": 0,
        "y": 0,
        "draw": false
      },
      "33": {
        "parts": [
          "33"
        ],
        "x": 0,
        "y": 0,
        "draw": false
      }
    },
    "code": "010140",
    "modeX": [
      210,
      330,
      450
    ],
    "modeY": 65,
    "map": {
      "page": 3,
      "focus": [
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
      ],
      "signals": {
        "1A": {
          "x": 1150.444,
          "y": 522.267
        },
        "1B": {
          "x": 1150.8,
          "y": 540.044
        }
      },
      "points": {},
      "paths": {}
    }
  }
};
const stations=Object.values(catalog).sort((a,b)=>a.order-b.order);
const api={catalog,stations};if(typeof module!=='undefined')module.exports=api;else root.SimNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
