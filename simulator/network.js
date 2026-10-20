(function(root){
'use strict';
const catalog={
  "cheongnyangni": {
    "id": "cheongnyangni",
    "name": "청량리",
    "order": 0,
    "controlled": true,
    "slide": 2,
    "image": "assets/stations/slide2.png",
    "width": 1910,
    "height": 1003,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 2"
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
    "modeY": 68
  },
  "jegidong": {
    "id": "jegidong",
    "name": "제기동",
    "order": 1,
    "controlled": false,
    "slide": 2,
    "image": "assets/stations/slide2.png",
    "width": 1910,
    "height": 1003,
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
    "image": "assets/stations/slide3.png",
    "width": 1913,
    "height": 947,
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
    "image": "assets/stations/slide3.png",
    "width": 1913,
    "height": 947,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 3"
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
    "modeY": 68
  },
  "dongdaemun": {
    "id": "dongdaemun",
    "name": "동대문",
    "order": 4,
    "controlled": false,
    "slide": 3,
    "image": "assets/stations/slide3.png",
    "width": 1913,
    "height": 947,
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
    "image": "assets/stations/slide3.png",
    "width": 1913,
    "height": 947,
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
    "image": "assets/stations/slide3.png",
    "width": 1913,
    "height": 947,
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
    "image": "assets/stations/slide4.png",
    "width": 1912,
    "height": 967,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 4"
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
    "modeY": 68
  },
  "cityhall": {
    "id": "cityhall",
    "name": "시청",
    "order": 8,
    "controlled": false,
    "slide": 4,
    "image": "assets/stations/slide4.png",
    "width": 1912,
    "height": 967,
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
    "image": "assets/stations/slide5.png",
    "width": 1905,
    "height": 991,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 5"
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
    "modeY": 67
  },
  "seoul": {
    "id": "seoul",
    "name": "서울",
    "order": 10,
    "controlled": true,
    "slide": 6,
    "image": "assets/stations/slide6.png",
    "width": 1916,
    "height": 1003,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 6"
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
    "modeY": 68
  },
  "namyeong": {
    "id": "namyeong",
    "name": "남영",
    "order": 11,
    "controlled": false,
    "slide": 6,
    "image": "assets/stations/slide6.png",
    "width": 1916,
    "height": 1003,
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
    "image": "assets/stations/slide7.png",
    "width": 1916,
    "height": 1004,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 7"
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
    "modeY": 77
  },
  "noryangjin": {
    "id": "noryangjin",
    "name": "노량진",
    "order": 13,
    "controlled": true,
    "slide": 8,
    "image": "assets/stations/slide8.png",
    "width": 1912,
    "height": 976,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 8"
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
    "modeY": 72
  },
  "daebang": {
    "id": "daebang",
    "name": "대방",
    "order": 14,
    "controlled": false,
    "slide": 8,
    "image": "assets/stations/slide8.png",
    "width": 1912,
    "height": 976,
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
    "image": "assets/stations/slide8.png",
    "width": 1912,
    "height": 976,
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
    "image": "assets/stations/slide9.png",
    "width": 1918,
    "height": 1003,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 9"
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
    "modeY": 62
  },
  "sindorim": {
    "id": "sindorim",
    "name": "신도림",
    "order": 17,
    "controlled": false,
    "slide": 9,
    "image": "assets/stations/slide9.png",
    "width": 1918,
    "height": 1003,
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
    "image": "assets/stations/slide10.png",
    "width": 1912,
    "height": 994,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 10"
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
    "modeY": 60
  },
  "gasan": {
    "id": "gasan",
    "name": "가산디지털",
    "order": 19,
    "controlled": false,
    "slide": 10,
    "image": "assets/stations/slide10.png",
    "width": 1912,
    "height": 994,
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
    "image": "assets/stations/slide10.png",
    "width": 1912,
    "height": 994,
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
    "image": "assets/stations/slide11.png",
    "width": 1916,
    "height": 988,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 11"
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
    "modeY": 65
  },
  "seoksu": {
    "id": "seoksu",
    "name": "석수",
    "order": 22,
    "controlled": false,
    "slide": 11,
    "image": "assets/stations/slide11.png",
    "width": 1916,
    "height": 988,
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
    "image": "assets/stations/slide12.png",
    "width": 1907,
    "height": 1008,
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
    "image": "assets/stations/slide12.png",
    "width": 1907,
    "height": 1008,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 12"
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
    "modeY": 65
  },
  "myeonghak": {
    "id": "myeonghak",
    "name": "명학",
    "order": 25,
    "controlled": false,
    "slide": 13,
    "image": "assets/stations/slide13.png",
    "width": 1919,
    "height": 980,
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
    "image": "assets/stations/slide14.png",
    "width": 1880,
    "height": 980,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 14"
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
    "modeY": 63
  },
  "gunpo": {
    "id": "gunpo",
    "name": "군포",
    "order": 27,
    "controlled": true,
    "slide": 15,
    "image": "assets/stations/slide15.png",
    "width": 1881,
    "height": 993,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 15"
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
    "modeY": 65
  },
  "dangjeong": {
    "id": "dangjeong",
    "name": "당정",
    "order": 28,
    "controlled": false,
    "slide": 16,
    "image": "assets/stations/slide16.png",
    "width": 1896,
    "height": 986,
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
    "image": "assets/stations/slide17.png",
    "width": 1886,
    "height": 992,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 17"
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
    "modeY": 69
  },
  "skku": {
    "id": "skku",
    "name": "성균관대",
    "order": 30,
    "controlled": false,
    "slide": 18,
    "image": "assets/stations/slide18.png",
    "width": 1901,
    "height": 996,
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
    "image": "assets/stations/slide18.png",
    "width": 1901,
    "height": 996,
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
    "image": "assets/stations/slide19.png",
    "width": 1904,
    "height": 992,
    "sources": {
      "wiring": "배선도(관제교육장).pptx · 슬라이드 19"
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
    "modeY": 65
  }
};
const stations=Object.values(catalog).sort((a,b)=>a.order-b.order);
const api={catalog,stations};if(typeof module!=='undefined')module.exports=api;else root.SimNetwork=api;
})(typeof window!=='undefined'?window:globalThis);
