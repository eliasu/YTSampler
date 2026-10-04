{
 "patcher": {
  "fileversion": 1,
  "appversion": {
   "major": 8,
   "minor": 6,
   "revision": 0,
   "architecture": "x64",
   "modernui": 1
  },
  "classnamespace": "box",
  "rect": [
   50,
   80,
   1400,
   1000
  ],
  "openinpresentation": 1,
  "default_fontsize": 10.0,
  "default_fontface": 0,
  "default_fontname": "Arial Bold",
  "gridonopen": 1,
  "gridsize": [
   8.0,
   8.0
  ],
  "boxes": [
   {
    "box": {
     "id": "obj-1",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 4,
     "patching_rect": [
      420.0,
      520.0,
      160.0,
      22.0
     ],
     "outlettype": [
      "",
      "",
      "",
      ""
     ],
     "text": "js ytsampler_main.js"
    }
   },
   {
    "box": {
     "id": "obj-2",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      520.0,
      330.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "node.script ytsampler_node.js @autostart 1 @watch 0"
    }
   },
   {
    "box": {
     "id": "obj-3",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      420.0,
      760.0,
      200.0,
      22.0
     ],
     "outlettype": [
      "signal",
      "signal"
     ],
     "text": "poly~ ytvoice 16 args ---ytbuf"
    }
   },
   {
    "box": {
     "id": "obj-4",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      700.0,
      120.0,
      22.0
     ],
     "outlettype": [
      "float",
      "bang"
     ],
     "text": "buffer~ ---ytbuf"
    }
   },
   {
    "box": {
     "id": "obj-5",
     "maxclass": "live.gain~",
     "numinlets": 2,
     "numoutlets": 5,
     "patching_rect": [
      420.0,
      800.0,
      44.0,
      140.0
     ],
     "outlettype": [
      "signal",
      "signal",
      "",
      "float",
      "list"
     ],
     "presentation": 1,
     "presentation_rect": [
      1326.0,
      5.0,
      48.0,
      154.0
     ],
     "channels": 2,
     "showname": 0,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Volume",
       "parameter_shortname": "Vol",
       "parameter_type": 0,
       "parameter_mmin": -70.0,
       "parameter_mmax": 6.0,
       "parameter_initial": [
        0.0
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 4
      }
     },
     "parameter_enable": 1,
     "varname": "Volume"
    }
   },
   {
    "box": {
     "id": "obj-6",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 0,
     "patching_rect": [
      420.0,
      960.0,
      68.0,
      22.0
     ],
     "text": "plugout~"
    }
   },
   {
    "box": {
     "id": "obj-7",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      700.0,
      20.0,
      117.0,
      22.0
     ],
     "outlettype": [
      "bang",
      "int",
      "int"
     ],
     "text": "live.thisdevice"
    }
   },
   {
    "box": {
     "id": "obj-8",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      700.0,
      55.0,
      61.0,
      22.0
     ],
     "outlettype": [
      "bang",
      "bang",
      "bang"
     ],
     "text": "t b b b"
    }
   },
   {
    "box": {
     "id": "obj-9",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      700.0,
      90.0,
      105.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "path live_set"
    }
   },
   {
    "box": {
     "id": "obj-10",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      700.0,
      120.0,
      75.0,
      22.0
     ],
     "outlettype": [
      "",
      "",
      ""
     ],
     "text": "live.path"
    }
   },
   {
    "box": {
     "id": "obj-11",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      700.0,
      150.0,
      145.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "live.observer tempo"
    }
   },
   {
    "box": {
     "id": "obj-12",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      700.0,
      180.0,
      89.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend bpm"
    }
   },
   {
    "box": {
     "id": "obj-13",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      820.0,
      90.0,
      42.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "init"
    }
   },
   {
    "box": {
     "id": "obj-14",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      850.0,
      150.0,
      173.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "live.observer root_note"
    }
   },
   {
    "box": {
     "id": "obj-15",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      1010.0,
      150.0,
      215.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "live.observer scale_intervals"
    }
   },
   {
    "box": {
     "id": "obj-16",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      850.0,
      180.0,
      131.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend scaleroot"
    }
   },
   {
    "box": {
     "id": "obj-17",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1010.0,
      180.0,
      131.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend scaleints"
    }
   },
   {
    "box": {
     "id": "obj-18",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      560.0,
      20.0,
      54.0,
      22.0
     ],
     "outlettype": [
      "int",
      "int",
      "int"
     ],
     "text": "notein"
    }
   },
   {
    "box": {
     "id": "obj-19",
     "maxclass": "newobj",
     "numinlets": 3,
     "numoutlets": 1,
     "patching_rect": [
      560.0,
      55.0,
      82.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "pack 0 0 0"
    }
   },
   {
    "box": {
     "id": "obj-20",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      560.0,
      90.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend note"
    }
   },
   {
    "box": {
     "id": "obj-21",
     "maxclass": "waveform~",
     "numinlets": 5,
     "numoutlets": 6,
     "patching_rect": [
      700.0,
      700.0,
      300.0,
      60.0
     ],
     "outlettype": [
      "float",
      "float",
      "float",
      "float",
      "list",
      ""
     ],
     "presentation": 1,
     "presentation_rect": [
      732.0,
      5.0,
      590.0,
      62.0
     ],
     "buffername": "---ytbuf"
    }
   },
   {
    "box": {
     "id": "obj-22",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      700.0,
      660.0,
      98.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "set ---ytbuf"
    }
   },
   {
    "box": {
     "id": "obj-23",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 6,
     "patching_rect": [
      40.0,
      560.0,
      290.0,
      22.0
     ],
     "outlettype": [
      "",
      "",
      "",
      "",
      "",
      ""
     ],
     "text": "route rclear radd status loaded needmaxlen"
    }
   },
   {
    "box": {
     "id": "obj-24",
     "maxclass": "umenu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      40.0,
      440.0,
      185.0,
      20.0
     ],
     "outlettype": [
      "int",
      "",
      ""
     ],
     "presentation": 1,
     "presentation_rect": [
      267.0,
      29.0,
      185.0,
      20.0
     ],
     "items": [],
     "arrow": 1,
     "varname": "results",
     "parameter_enable": 0
    }
   },
   {
    "box": {
     "id": "obj-25",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      600.0,
      49.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "clear"
    }
   },
   {
    "box": {
     "id": "obj-26",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      100.0,
      600.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend append"
    }
   },
   {
    "box": {
     "id": "obj-27",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      40.0,
      480.0,
      245.0,
      20.0
     ],
     "text": "Status",
     "presentation": 1,
     "presentation_rect": [
      267.0,
      79.0,
      245.0,
      44.0
     ],
     "varname": "statustext"
    }
   },
   {
    "box": {
     "id": "obj-28",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      230.0,
      600.0,
      89.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend set"
    }
   },
   {
    "box": {
     "id": "obj-29",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      330.0,
      600.0,
      47.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "t l l"
    }
   },
   {
    "box": {
     "id": "obj-30",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      380.0,
      630.0,
      82.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "zl slice 1"
    }
   },
   {
    "box": {
     "id": "obj-31",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      380.0,
      660.0,
      117.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend replace"
    }
   },
   {
    "box": {
     "id": "obj-32",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      330.0,
      700.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend loaded"
    }
   },
   {
    "box": {
     "id": "obj-33",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      40.0,
      330.0,
      120.0,
      20.0
     ],
     "text": "Suche / URL"
    }
   },
   {
    "box": {
     "id": "obj-34",
     "maxclass": "textedit",
     "numinlets": 1,
     "numoutlets": 4,
     "patching_rect": [
      40.0,
      360.0,
      180.0,
      20.0
     ],
     "outlettype": [
      "",
      "int",
      "",
      ""
     ],
     "text": "",
     "presentation": 1,
     "presentation_rect": [
      267.0,
      5.0,
      137.0,
      20.0
     ],
     "keymode": 1,
     "lines": 1,
     "varname": "query"
    }
   },
   {
    "box": {
     "id": "obj-35",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      230.0,
      360.0,
      56.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Suche",
     "presentation": 1,
     "presentation_rect": [
      456.0,
      5.0,
      56.0,
      20.0
     ],
     "mode": 0,
     "texton": "Suche",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Search",
       "parameter_shortname": "Search",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Search"
    }
   },
   {
    "box": {
     "id": "obj-36",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      395.0,
      82.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "route text"
    }
   },
   {
    "box": {
     "id": "obj-37",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      420.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend search"
    }
   },
   {
    "box": {
     "id": "obj-38",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      230.0,
      395.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-39",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      320.0,
      360.0,
      50.0,
      20.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      408.0,
      5.0,
      44.0,
      20.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Max Length",
       "parameter_shortname": "Max Len",
       "parameter_type": 1,
       "parameter_mmin": 1,
       "parameter_mmax": 20,
       "parameter_initial": [
        7
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 9,
       "parameter_units": "%d min"
      }
     },
     "parameter_enable": 1,
     "varname": "Max Length"
    }
   },
   {
    "box": {
     "id": "obj-40",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      320.0,
      395.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend maxlen"
    }
   },
   {
    "box": {
     "id": "obj-41",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      180.0,
      600.0,
      42.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "bang"
    }
   },
   {
    "box": {
     "id": "obj-42",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      300.0,
      440.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend pick"
    }
   },
   {
    "box": {
     "id": "obj-43",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      230.0,
      440.0,
      56.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Laden",
     "presentation": 1,
     "presentation_rect": [
      456.0,
      29.0,
      56.0,
      20.0
     ],
     "mode": 0,
     "texton": "Laden",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Load Result",
       "parameter_shortname": "Load Result",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Load Result"
    }
   },
   {
    "box": {
     "id": "obj-44",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      230.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-45",
     "maxclass": "textedit",
     "numinlets": 1,
     "numoutlets": 4,
     "patching_rect": [
      40.0,
      250.0,
      180.0,
      20.0
     ],
     "outlettype": [
      "",
      "int",
      "",
      ""
     ],
     "text": "",
     "presentation": 1,
     "presentation_rect": [
      267.0,
      54.0,
      185.0,
      20.0
     ],
     "keymode": 1,
     "lines": 1,
     "varname": "url"
    }
   },
   {
    "box": {
     "id": "obj-46",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      230.0,
      250.0,
      56.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Laden",
     "presentation": 1,
     "presentation_rect": [
      456.0,
      54.0,
      56.0,
      20.0
     ],
     "mode": 0,
     "texton": "Laden",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Load URL",
       "parameter_shortname": "Load URL",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Load URL"
    }
   },
   {
    "box": {
     "id": "obj-47",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      285.0,
      82.0,
      22.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "route text"
    }
   },
   {
    "box": {
     "id": "obj-48",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      310.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend load"
    }
   },
   {
    "box": {
     "id": "obj-49",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      230.0,
      285.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-50",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      140.0,
      60.0,
      18.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Session",
       "parameter_shortname": "Session",
       "parameter_type": 1,
       "parameter_mmin": 0,
       "parameter_mmax": 999999,
       "parameter_initial": [
        0
       ],
       "parameter_initial_enable": 1,
       "parameter_invisible": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Session"
    }
   },
   {
    "box": {
     "id": "obj-51",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      170.0,
      131.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend sessionid"
    }
   },
   {
    "box": {
     "id": "obj-52",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      1500.0,
      20.0,
      70.0,
      20.0
     ],
     "text": "Favoriten",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      5.0,
      60.0,
      16.0
     ],
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-53",
     "maxclass": "live.tab",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      1500.0,
      45.0,
      110.0,
      18.0
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      66.0,
      4.0,
      120.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Bank",
       "parameter_shortname": "Fav Bank",
       "parameter_type": 2,
       "parameter_enum": [
        "A",
        "B",
        "C",
        "D"
       ],
       "parameter_mmax": 3,
       "parameter_initial": [
        0
       ],
       "parameter_initial_enable": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favbank",
     "num_lines_patching": 1,
     "num_lines_presentation": 1
    }
   },
   {
    "box": {
     "id": "obj-54",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      70.0,
      117.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend favbank"
    }
   },
   {
    "box": {
     "id": "obj-55",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1630.0,
      45.0,
      44.0,
      18.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      191.0,
      4.0,
      63.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Select",
       "parameter_shortname": "Fav Select",
       "parameter_type": 1,
       "parameter_mmin": 1,
       "parameter_mmax": 64,
       "parameter_initial": [
        1
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 9,
       "parameter_units": "Fav %d"
      }
     },
     "parameter_enable": 1,
     "varname": "favsel"
    }
   },
   {
    "box": {
     "id": "obj-56",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1630.0,
      70.0,
      131.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend favselect"
    }
   },
   {
    "box": {
     "id": "obj-57",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      110.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      26.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 1",
       "parameter_shortname": "Fav Slot 1",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot1",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-58",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      135.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-59",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      158.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 1"
    }
   },
   {
    "box": {
     "id": "obj-60",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1590.0,
      110.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      68.0,
      26.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 2",
       "parameter_shortname": "Fav Slot 2",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot2",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-61",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      135.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-62",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      158.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 2"
    }
   },
   {
    "box": {
     "id": "obj-63",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1680.0,
      110.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      131.0,
      26.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 3",
       "parameter_shortname": "Fav Slot 3",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot3",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-64",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      135.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-65",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      158.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 3"
    }
   },
   {
    "box": {
     "id": "obj-66",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1770.0,
      110.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      194.0,
      26.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 4",
       "parameter_shortname": "Fav Slot 4",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot4",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-67",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      135.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-68",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      158.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 4"
    }
   },
   {
    "box": {
     "id": "obj-69",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      190.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      48.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 5",
       "parameter_shortname": "Fav Slot 5",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot5",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-70",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      215.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-71",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      238.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 5"
    }
   },
   {
    "box": {
     "id": "obj-72",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1590.0,
      190.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      68.0,
      48.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 6",
       "parameter_shortname": "Fav Slot 6",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot6",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-73",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      215.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-74",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      238.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 6"
    }
   },
   {
    "box": {
     "id": "obj-75",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1680.0,
      190.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      131.0,
      48.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 7",
       "parameter_shortname": "Fav Slot 7",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot7",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-76",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      215.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-77",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      238.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 7"
    }
   },
   {
    "box": {
     "id": "obj-78",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1770.0,
      190.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      194.0,
      48.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 8",
       "parameter_shortname": "Fav Slot 8",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot8",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-79",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      215.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-80",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      238.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 8"
    }
   },
   {
    "box": {
     "id": "obj-81",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      270.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      70.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 9",
       "parameter_shortname": "Fav Slot 9",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot9",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-82",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      295.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-83",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      318.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 9"
    }
   },
   {
    "box": {
     "id": "obj-84",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1590.0,
      270.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      68.0,
      70.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 10",
       "parameter_shortname": "Fav Slot 10",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot10",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-85",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      295.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-86",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      318.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 10"
    }
   },
   {
    "box": {
     "id": "obj-87",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1680.0,
      270.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      131.0,
      70.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 11",
       "parameter_shortname": "Fav Slot 11",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot11",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-88",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      295.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-89",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      318.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 11"
    }
   },
   {
    "box": {
     "id": "obj-90",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1770.0,
      270.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      194.0,
      70.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 12",
       "parameter_shortname": "Fav Slot 12",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot12",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-91",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      295.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-92",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      318.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 12"
    }
   },
   {
    "box": {
     "id": "obj-93",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      350.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      92.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 13",
       "parameter_shortname": "Fav Slot 13",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot13",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-94",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      375.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-95",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      398.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 13"
    }
   },
   {
    "box": {
     "id": "obj-96",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1590.0,
      350.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      68.0,
      92.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 14",
       "parameter_shortname": "Fav Slot 14",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot14",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-97",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      375.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-98",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      398.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 14"
    }
   },
   {
    "box": {
     "id": "obj-99",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1680.0,
      350.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      131.0,
      92.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 15",
       "parameter_shortname": "Fav Slot 15",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot15",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-100",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      375.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-101",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      398.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 15"
    }
   },
   {
    "box": {
     "id": "obj-102",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1770.0,
      350.0,
      60.0,
      20.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "·",
     "presentation": 1,
     "presentation_rect": [
      194.0,
      92.0,
      60.0,
      20.0
     ],
     "mode": 1,
     "texton": "·",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Slot 16",
       "parameter_shortname": "Fav Slot 16",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "favslot16",
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-103",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      375.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-104",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      398.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favslot 16"
    }
   },
   {
    "box": {
     "id": "obj-105",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      440.0,
      28.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "◀",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      116.0,
      28.0,
      18.0
     ],
     "mode": 0,
     "texton": "◀",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Prev",
       "parameter_shortname": "Fav Prev",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Fav Prev"
    }
   },
   {
    "box": {
     "id": "obj-106",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-107",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      500.0,
      63.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favprev"
    }
   },
   {
    "box": {
     "id": "obj-108",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1590.0,
      440.0,
      28.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "▶",
     "presentation": 1,
     "presentation_rect": [
      36.0,
      116.0,
      28.0,
      18.0
     ],
     "mode": 0,
     "texton": "▶",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Next",
       "parameter_shortname": "Fav Next",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Fav Next"
    }
   },
   {
    "box": {
     "id": "obj-109",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-110",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1590.0,
      500.0,
      63.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favnext"
    }
   },
   {
    "box": {
     "id": "obj-111",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1680.0,
      440.0,
      60.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "+ Neu",
     "presentation": 1,
     "presentation_rect": [
      68.0,
      116.0,
      60.0,
      18.0
     ],
     "mode": 0,
     "texton": "+ Neu",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Add",
       "parameter_shortname": "Fav Add",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Fav Add"
    }
   },
   {
    "box": {
     "id": "obj-112",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-113",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1680.0,
      500.0,
      56.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favadd"
    }
   },
   {
    "box": {
     "id": "obj-114",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1770.0,
      440.0,
      60.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Update",
     "presentation": 1,
     "presentation_rect": [
      131.0,
      116.0,
      60.0,
      18.0
     ],
     "mode": 0,
     "texton": "Update",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Update",
       "parameter_shortname": "Fav Update",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Fav Update"
    }
   },
   {
    "box": {
     "id": "obj-115",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-116",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1770.0,
      500.0,
      77.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favupdate"
    }
   },
   {
    "box": {
     "id": "obj-117",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1860.0,
      440.0,
      60.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Löschen",
     "presentation": 1,
     "presentation_rect": [
      194.0,
      116.0,
      60.0,
      18.0
     ],
     "mode": 0,
     "texton": "Löschen",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Fav Delete",
       "parameter_shortname": "Fav Delete",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Fav Delete"
    }
   },
   {
    "box": {
     "id": "obj-118",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1860.0,
      470.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-119",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1860.0,
      500.0,
      77.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "favdelete"
    }
   },
   {
    "box": {
     "id": "obj-120",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      1500.0,
      540.0,
      250.0,
      20.0
     ],
     "text": "kein Favorit aktiv",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      138.0,
      250.0,
      28.0
     ],
     "varname": "favinfo"
    }
   },
   {
    "box": {
     "id": "obj-121",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 8,
     "patching_rect": [
      600.0,
      580.0,
      420.0,
      22.0
     ],
     "outlettype": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
     ],
     "text": "route memclear memadd selinfo lockset wsel status grid"
    }
   },
   {
    "box": {
     "id": "obj-122",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      700.0,
      740.0,
      590.0,
      20.0
     ],
     "text": "Pad 1",
     "presentation": 1,
     "presentation_rect": [
      732.0,
      69.0,
      590.0,
      18.0
     ],
     "varname": "selinfo"
    }
   },
   {
    "box": {
     "id": "obj-123",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      760.0,
      620.0,
      89.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend set"
    }
   },
   {
    "box": {
     "id": "obj-124",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      900.0,
      620.0,
      96.0,
      22.0
     ],
     "outlettype": [
      "float",
      "float"
     ],
     "text": "unpack 0. 0."
    }
   },
   {
    "box": {
     "id": "obj-125",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      620.0,
      89.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend set"
    }
   },
   {
    "box": {
     "id": "obj-126",
     "maxclass": "jsui",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1100.0,
      40.0,
      204.0,
      153.0
     ],
     "outlettype": [
      ""
     ],
     "presentation": 1,
     "presentation_rect": [
      524.0,
      5.0,
      204.0,
      153.0
     ],
     "filename": "ytpads.js",
     "parameter_enable": 0,
     "varname": "pads"
    }
   },
   {
    "box": {
     "id": "obj-127",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      900.0,
      20.0,
      60.0,
      20.0
     ],
     "text": "Slice",
     "presentation": 1,
     "presentation_rect": [
      732.0,
      90.0,
      60.0,
      16.0
     ],
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-128",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      900.0,
      40.0,
      70.0,
      18.0
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      732.0,
      105.0,
      60.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Division",
       "parameter_shortname": "Division",
       "parameter_type": 2,
       "parameter_enum": [
        "1/64",
        "1/32",
        "1/16T",
        "1/16",
        "1/8T",
        "1/8",
        "1/4T",
        "1/4",
        "1/2",
        "1 Bar",
        "2 Bars"
       ],
       "parameter_mmax": 10,
       "parameter_initial": [
        5
       ],
       "parameter_initial_enable": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Division"
    }
   },
   {
    "box": {
     "id": "obj-129",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      900.0,
      70.0,
      124.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend division"
    }
   },
   {
    "box": {
     "id": "obj-130",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      980.0,
      20.0,
      60.0,
      20.0
     ],
     "text": "Base Note",
     "presentation": 1,
     "presentation_rect": [
      732.0,
      125.0,
      60.0,
      16.0
     ],
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-131",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      980.0,
      40.0,
      50.0,
      18.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      732.0,
      140.0,
      60.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Base Note",
       "parameter_shortname": "Base Note",
       "parameter_type": 1,
       "parameter_mmin": 0,
       "parameter_mmax": 127,
       "parameter_initial": [
        36
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 8
      }
     },
     "parameter_enable": 1,
     "varname": "Base Note"
    }
   },
   {
    "box": {
     "id": "obj-132",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      70.0,
      124.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend basenote"
    }
   },
   {
    "box": {
     "id": "obj-133",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      980.0,
      90.0,
      45.0,
      20.0
     ],
     "text": "Voices",
     "presentation": 1,
     "presentation_rect": [
      797.0,
      145.0,
      42.0,
      14.0
     ],
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-134",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      980.0,
      110.0,
      60.0,
      18.0
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      840.0,
      143.0,
      52.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Voices",
       "parameter_shortname": "Voices",
       "parameter_type": 2,
       "parameter_enum": [
        "Mono",
        "2",
        "3",
        "4",
        "5",
        "8",
        "16"
       ],
       "parameter_mmax": 6,
       "parameter_initial": [
        6
       ],
       "parameter_initial_enable": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Voices"
    }
   },
   {
    "box": {
     "id": "obj-135",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      140.0,
      138.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend voicecount"
    }
   },
   {
    "box": {
     "id": "obj-136",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1300.0,
      450.0,
      78.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Tune",
     "presentation": 1,
     "presentation_rect": [
      1074.0,
      92.0,
      78.0,
      18.0
     ],
     "mode": 1,
     "texton": "Tune ✓",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Tune",
       "parameter_shortname": "Tune",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Tune"
    }
   },
   {
    "box": {
     "id": "obj-137",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1300.0,
      480.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend tune"
    }
   },
   {
    "box": {
     "id": "obj-138",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1400.0,
      450.0,
      44.0,
      48.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      1091.0,
      112.0,
      44.0,
      48.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Tonal",
       "parameter_shortname": "Tonal",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 1.0,
       "parameter_initial": [
        0.5
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 1,
       "parameter_exponent": 1.0
      }
     },
     "parameter_enable": 1,
     "varname": "Tonal"
    }
   },
   {
    "box": {
     "id": "obj-139",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1400.0,
      510.0,
      131.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend threshold"
    }
   },
   {
    "box": {
     "id": "obj-140",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1300.0,
      600.0,
      78.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Warp",
     "presentation": 1,
     "presentation_rect": [
      1158.0,
      92.0,
      78.0,
      18.0
     ],
     "mode": 1,
     "texton": "Warp ✓",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Warp",
       "parameter_shortname": "Warp",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Warp"
    }
   },
   {
    "box": {
     "id": "obj-141",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1300.0,
      630.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend warp"
    }
   },
   {
    "box": {
     "id": "obj-142",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1400.0,
      600.0,
      70.0,
      18.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      1158.0,
      114.0,
      78.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Source BPM",
       "parameter_shortname": "Src BPM",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 300.0,
       "parameter_initial": [
        0.0
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 9,
       "parameter_units": "%.1f BPM"
      }
     },
     "parameter_enable": 1,
     "varname": "srcbpm"
    }
   },
   {
    "box": {
     "id": "obj-143",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1400.0,
      630.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend srcbpm"
    }
   },
   {
    "box": {
     "id": "obj-144",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1500.0,
      600.0,
      38.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "÷2",
     "presentation": 1,
     "presentation_rect": [
      1158.0,
      136.0,
      38.0,
      18.0
     ],
     "mode": 0,
     "texton": "÷2",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "BPM Half",
       "parameter_shortname": "BPM Half",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "BPM Half"
    }
   },
   {
    "box": {
     "id": "obj-145",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      630.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-146",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1500.0,
      660.0,
      63.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "bpmhalf"
    }
   },
   {
    "box": {
     "id": "obj-147",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1580.0,
      600.0,
      38.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "×2",
     "presentation": 1,
     "presentation_rect": [
      1198.0,
      136.0,
      38.0,
      18.0
     ],
     "mode": 0,
     "texton": "×2",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "BPM Double",
       "parameter_shortname": "BPM Double",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "BPM Double"
    }
   },
   {
    "box": {
     "id": "obj-148",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1580.0,
      630.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-149",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1580.0,
      660.0,
      77.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "bpmdouble"
    }
   },
   {
    "box": {
     "id": "obj-150",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      900.0,
      110.0,
      44.0,
      48.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      797.0,
      92.0,
      44.0,
      48.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Rate",
       "parameter_shortname": "Rate",
       "parameter_type": 0,
       "parameter_mmin": 0.25,
       "parameter_mmax": 2.0,
       "parameter_initial": [
        1.0
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 1,
       "parameter_exponent": 1.0
      }
     },
     "parameter_enable": 1,
     "varname": "Rate"
    }
   },
   {
    "box": {
     "id": "obj-151",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      900.0,
      170.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend rate"
    }
   },
   {
    "box": {
     "id": "obj-152",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      970.0,
      110.0,
      44.0,
      48.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      845.0,
      92.0,
      44.0,
      48.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Attack",
       "parameter_shortname": "Attack",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 50.0,
       "parameter_initial": [
        2.0
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 2,
       "parameter_exponent": 1.0
      }
     },
     "parameter_enable": 1,
     "varname": "Attack"
    }
   },
   {
    "box": {
     "id": "obj-153",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      970.0,
      170.0,
      110.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend attack"
    }
   },
   {
    "box": {
     "id": "obj-154",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1040.0,
      110.0,
      44.0,
      48.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      893.0,
      92.0,
      44.0,
      48.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Release",
       "parameter_shortname": "Release",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 500.0,
       "parameter_initial": [
        20.0
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 2,
       "parameter_exponent": 1.0
      }
     },
     "parameter_enable": 1,
     "varname": "Release"
    }
   },
   {
    "box": {
     "id": "obj-155",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1040.0,
      170.0,
      117.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend release"
    }
   },
   {
    "box": {
     "id": "obj-156",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      900.0,
      220.0,
      50.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Trigger",
     "presentation": 1,
     "presentation_rect": [
      942.0,
      92.0,
      50.0,
      18.0
     ],
     "mode": 1,
     "texton": "Hold",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Mode",
       "parameter_shortname": "Mode",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Mode"
    }
   },
   {
    "box": {
     "id": "obj-157",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      900.0,
      250.0,
      124.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend playmode"
    }
   },
   {
    "box": {
     "id": "obj-158",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      980.0,
      220.0,
      50.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Rev",
     "presentation": 1,
     "presentation_rect": [
      942.0,
      114.0,
      50.0,
      18.0
     ],
     "mode": 1,
     "texton": "Rev",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Reverse",
       "parameter_shortname": "Reverse",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Reverse"
    }
   },
   {
    "box": {
     "id": "obj-159",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      250.0,
      117.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend reverse"
    }
   },
   {
    "box": {
     "id": "obj-160",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1060.0,
      220.0,
      50.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Lock",
     "presentation": 1,
     "presentation_rect": [
      942.0,
      136.0,
      50.0,
      18.0
     ],
     "mode": 1,
     "texton": "Lock",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Lock",
       "parameter_shortname": "Lock",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Lock"
    }
   },
   {
    "box": {
     "id": "obj-161",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1060.0,
      250.0,
      96.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend lock"
    }
   },
   {
    "box": {
     "id": "obj-162",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      860.0,
      660.0,
      89.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "prepend set"
    }
   },
   {
    "box": {
     "id": "obj-163",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      900.0,
      300.0,
      70.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Shuffle",
     "presentation": 1,
     "presentation_rect": [
      997.0,
      92.0,
      70.0,
      18.0
     ],
     "mode": 0,
     "texton": "Shuffle",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Shuffle",
       "parameter_shortname": "Shuffle",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Shuffle"
    }
   },
   {
    "box": {
     "id": "obj-164",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      900.0,
      330.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-165",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      900.0,
      400.0,
      63.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "shuffle"
    }
   },
   {
    "box": {
     "id": "obj-166",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      980.0,
      300.0,
      70.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Reroll Pad",
     "presentation": 1,
     "presentation_rect": [
      997.0,
      114.0,
      70.0,
      18.0
     ],
     "mode": 0,
     "texton": "Reroll Pad",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Reroll",
       "parameter_shortname": "Reroll",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Reroll"
    }
   },
   {
    "box": {
     "id": "obj-167",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      330.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-168",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      980.0,
      400.0,
      56.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "reroll"
    }
   },
   {
    "box": {
     "id": "obj-169",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1060.0,
      300.0,
      34.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "◀",
     "presentation": 1,
     "presentation_rect": [
      997.0,
      136.0,
      34.0,
      18.0
     ],
     "mode": 0,
     "texton": "◀",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Nudge Left",
       "parameter_shortname": "Nudge Left",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Nudge Left"
    }
   },
   {
    "box": {
     "id": "obj-170",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1060.0,
      330.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-171",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1060.0,
      400.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "nudge -1"
    }
   },
   {
    "box": {
     "id": "obj-172",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1140.0,
      300.0,
      34.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "▶",
     "presentation": 1,
     "presentation_rect": [
      1033.0,
      136.0,
      34.0,
      18.0
     ],
     "mode": 0,
     "texton": "▶",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Nudge Right",
       "parameter_shortname": "Nudge Right",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Nudge Right"
    }
   },
   {
    "box": {
     "id": "obj-173",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      1140.0,
      330.0,
      40.0,
      22.0
     ],
     "outlettype": [
      "bang"
     ],
     "text": "t b"
    }
   },
   {
    "box": {
     "id": "obj-174",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      1140.0,
      400.0,
      63.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "nudge 1"
    }
   },
   {
    "box": {
     "id": "obj-175",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "signal",
      "signal"
     ],
     "patching_rect": [
      650.0,
      760.0,
      220.0,
      22.0
     ],
     "text": "poly~ ytwarpvoice 16 args ---ytbuf"
    }
   },
   {
    "box": {
     "id": "obj-176",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1700.0,
      600.0,
      78.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Grid",
     "presentation": 1,
     "presentation_rect": [
      1242.0,
      92.0,
      78.0,
      18.0
     ],
     "mode": 1,
     "texton": "Grid ✓",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Grid",
       "parameter_shortname": "Grid",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Grid"
    }
   },
   {
    "box": {
     "id": "obj-177",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      1700.0,
      630.0,
      90.0,
      22.0
     ],
     "text": "prepend gridon"
    }
   },
   {
    "box": {
     "id": "obj-178",
     "maxclass": "live.menu",
     "numinlets": 1,
     "numoutlets": 3,
     "patching_rect": [
      1800.0,
      600.0,
      78.0,
      18.0
     ],
     "outlettype": [
      "",
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      1242.0,
      114.0,
      78.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Snap",
       "parameter_shortname": "Snap",
       "parameter_type": 2,
       "parameter_enum": [
        "Snap Slice",
        "Snap Beat",
        "Snap Bar"
       ],
       "parameter_mmax": 2,
       "parameter_initial": [
        0
       ],
       "parameter_initial_enable": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Snap"
    }
   },
   {
    "box": {
     "id": "obj-179",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      1800.0,
      630.0,
      100.0,
      22.0
     ],
     "text": "prepend snapmode"
    }
   },
   {
    "box": {
     "id": "obj-180",
     "maxclass": "jsui",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      700.0,
      780.0,
      300.0,
      62.0
     ],
     "presentation": 1,
     "presentation_rect": [
      732.0,
      5.0,
      590.0,
      62.0
     ],
     "filename": "ytgrid.js",
     "parameter_enable": 0,
     "ignoreclick": 1,
     "varname": "gridui"
    }
   }
  ],
  "lines": [
   {
    "patchline": {
     "source": [
      "obj-3",
      0
     ],
     "destination": [
      "obj-5",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      1
     ],
     "destination": [
      "obj-5",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-5",
      0
     ],
     "destination": [
      "obj-6",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-5",
      1
     ],
     "destination": [
      "obj-6",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      1
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-7",
      0
     ],
     "destination": [
      "obj-8",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-8",
      0
     ],
     "destination": [
      "obj-9",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-9",
      0
     ],
     "destination": [
      "obj-10",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-10",
      0
     ],
     "destination": [
      "obj-11",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-11",
      0
     ],
     "destination": [
      "obj-12",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-12",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-8",
      2
     ],
     "destination": [
      "obj-13",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-10",
      0
     ],
     "destination": [
      "obj-14",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-10",
      0
     ],
     "destination": [
      "obj-15",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-14",
      0
     ],
     "destination": [
      "obj-16",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-16",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-15",
      0
     ],
     "destination": [
      "obj-17",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-17",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      0
     ],
     "destination": [
      "obj-19",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      1
     ],
     "destination": [
      "obj-19",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      2
     ],
     "destination": [
      "obj-19",
      2
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-19",
      0
     ],
     "destination": [
      "obj-20",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-20",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-8",
      1
     ],
     "destination": [
      "obj-22",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-4",
      1
     ],
     "destination": [
      "obj-22",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-22",
      0
     ],
     "destination": [
      "obj-21",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-2",
      0
     ],
     "destination": [
      "obj-23",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      0
     ],
     "destination": [
      "obj-25",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-25",
      0
     ],
     "destination": [
      "obj-24",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      1
     ],
     "destination": [
      "obj-26",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-26",
      0
     ],
     "destination": [
      "obj-24",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      2
     ],
     "destination": [
      "obj-28",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-28",
      0
     ],
     "destination": [
      "obj-27",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      3
     ],
     "destination": [
      "obj-29",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-29",
      1
     ],
     "destination": [
      "obj-30",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-30",
      0
     ],
     "destination": [
      "obj-31",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-31",
      0
     ],
     "destination": [
      "obj-4",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-29",
      0
     ],
     "destination": [
      "obj-32",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-32",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      5
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-34",
      0
     ],
     "destination": [
      "obj-36",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-36",
      0
     ],
     "destination": [
      "obj-37",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-36",
      1
     ],
     "destination": [
      "obj-37",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-37",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-35",
      0
     ],
     "destination": [
      "obj-38",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-38",
      0
     ],
     "destination": [
      "obj-34",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-39",
      0
     ],
     "destination": [
      "obj-40",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-40",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      4
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-41",
      0
     ],
     "destination": [
      "obj-39",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-24",
      0
     ],
     "destination": [
      "obj-42",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-42",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      0
     ],
     "destination": [
      "obj-44",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-44",
      0
     ],
     "destination": [
      "obj-24",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-45",
      0
     ],
     "destination": [
      "obj-47",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-47",
      0
     ],
     "destination": [
      "obj-48",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-47",
      1
     ],
     "destination": [
      "obj-48",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-48",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-46",
      0
     ],
     "destination": [
      "obj-49",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-49",
      0
     ],
     "destination": [
      "obj-45",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-50",
      0
     ],
     "destination": [
      "obj-51",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-51",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-53",
      0
     ],
     "destination": [
      "obj-54",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-54",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-55",
      0
     ],
     "destination": [
      "obj-56",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-56",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-57",
      0
     ],
     "destination": [
      "obj-58",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-58",
      0
     ],
     "destination": [
      "obj-59",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-59",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-60",
      0
     ],
     "destination": [
      "obj-61",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-61",
      0
     ],
     "destination": [
      "obj-62",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-62",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-63",
      0
     ],
     "destination": [
      "obj-64",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-64",
      0
     ],
     "destination": [
      "obj-65",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-65",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-66",
      0
     ],
     "destination": [
      "obj-67",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-67",
      0
     ],
     "destination": [
      "obj-68",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-68",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-69",
      0
     ],
     "destination": [
      "obj-70",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-70",
      0
     ],
     "destination": [
      "obj-71",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-71",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-72",
      0
     ],
     "destination": [
      "obj-73",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-73",
      0
     ],
     "destination": [
      "obj-74",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-74",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-75",
      0
     ],
     "destination": [
      "obj-76",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-76",
      0
     ],
     "destination": [
      "obj-77",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-77",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-78",
      0
     ],
     "destination": [
      "obj-79",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-79",
      0
     ],
     "destination": [
      "obj-80",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-80",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-81",
      0
     ],
     "destination": [
      "obj-82",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-82",
      0
     ],
     "destination": [
      "obj-83",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-83",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-84",
      0
     ],
     "destination": [
      "obj-85",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-85",
      0
     ],
     "destination": [
      "obj-86",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-86",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-87",
      0
     ],
     "destination": [
      "obj-88",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-88",
      0
     ],
     "destination": [
      "obj-89",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-89",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-90",
      0
     ],
     "destination": [
      "obj-91",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-91",
      0
     ],
     "destination": [
      "obj-92",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-92",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-93",
      0
     ],
     "destination": [
      "obj-94",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-94",
      0
     ],
     "destination": [
      "obj-95",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-95",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-96",
      0
     ],
     "destination": [
      "obj-97",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-97",
      0
     ],
     "destination": [
      "obj-98",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-98",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-99",
      0
     ],
     "destination": [
      "obj-100",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-100",
      0
     ],
     "destination": [
      "obj-101",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-101",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-102",
      0
     ],
     "destination": [
      "obj-103",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-103",
      0
     ],
     "destination": [
      "obj-104",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-104",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-105",
      0
     ],
     "destination": [
      "obj-106",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-106",
      0
     ],
     "destination": [
      "obj-107",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-107",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-108",
      0
     ],
     "destination": [
      "obj-109",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-109",
      0
     ],
     "destination": [
      "obj-110",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-110",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-111",
      0
     ],
     "destination": [
      "obj-112",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-112",
      0
     ],
     "destination": [
      "obj-113",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-113",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-114",
      0
     ],
     "destination": [
      "obj-115",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-115",
      0
     ],
     "destination": [
      "obj-116",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-116",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-117",
      0
     ],
     "destination": [
      "obj-118",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-118",
      0
     ],
     "destination": [
      "obj-119",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-119",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      2
     ],
     "destination": [
      "obj-121",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      2
     ],
     "destination": [
      "obj-123",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-123",
      0
     ],
     "destination": [
      "obj-122",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      4
     ],
     "destination": [
      "obj-124",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-124",
      0
     ],
     "destination": [
      "obj-21",
      3
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-124",
      1
     ],
     "destination": [
      "obj-21",
      4
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      5
     ],
     "destination": [
      "obj-125",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-125",
      0
     ],
     "destination": [
      "obj-27",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-126",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      7
     ],
     "destination": [
      "obj-126",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-128",
      0
     ],
     "destination": [
      "obj-129",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-129",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-131",
      0
     ],
     "destination": [
      "obj-132",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-132",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-134",
      0
     ],
     "destination": [
      "obj-135",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-135",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-136",
      0
     ],
     "destination": [
      "obj-137",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-137",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-138",
      0
     ],
     "destination": [
      "obj-139",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-139",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-140",
      0
     ],
     "destination": [
      "obj-141",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-141",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-142",
      0
     ],
     "destination": [
      "obj-143",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-143",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-144",
      0
     ],
     "destination": [
      "obj-145",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-145",
      0
     ],
     "destination": [
      "obj-146",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-146",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-147",
      0
     ],
     "destination": [
      "obj-148",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-148",
      0
     ],
     "destination": [
      "obj-149",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-149",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-150",
      0
     ],
     "destination": [
      "obj-151",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-151",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-152",
      0
     ],
     "destination": [
      "obj-153",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-153",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-154",
      0
     ],
     "destination": [
      "obj-155",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-155",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-156",
      0
     ],
     "destination": [
      "obj-157",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-157",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-158",
      0
     ],
     "destination": [
      "obj-159",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-159",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-160",
      0
     ],
     "destination": [
      "obj-161",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-161",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      3
     ],
     "destination": [
      "obj-162",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-162",
      0
     ],
     "destination": [
      "obj-160",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-163",
      0
     ],
     "destination": [
      "obj-164",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-164",
      0
     ],
     "destination": [
      "obj-165",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-165",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-166",
      0
     ],
     "destination": [
      "obj-167",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-167",
      0
     ],
     "destination": [
      "obj-168",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-168",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-169",
      0
     ],
     "destination": [
      "obj-170",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-170",
      0
     ],
     "destination": [
      "obj-171",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-171",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-172",
      0
     ],
     "destination": [
      "obj-173",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-173",
      0
     ],
     "destination": [
      "obj-174",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-174",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      3
     ],
     "destination": [
      "obj-175",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-175",
      0
     ],
     "destination": [
      "obj-5",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-175",
      1
     ],
     "destination": [
      "obj-5",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-176",
      0
     ],
     "destination": [
      "obj-177",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-177",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-178",
      0
     ],
     "destination": [
      "obj-179",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-179",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      6
     ],
     "destination": [
      "obj-180",
      0
     ]
    }
   }
  ],
  "devicewidth": 1378.0
 }
}