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
     "numoutlets": 5,
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
      972.0,
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
      378.0,
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
      5.0,
      94.0,
      160.0,
      70.0
     ],
     "varname": "statustext"
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
     "id": "obj-121",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 7,
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
      ""
     ],
     "text": "route shownr showname selinfo wsel status grid"
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
      378.0,
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
      170.0,
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
      378.0,
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
      378.0,
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
      378.0,
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
      378.0,
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
      443.0,
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
      486.0,
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
      645.0,
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
      662.0,
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
      729.0,
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
      729.0,
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
      729.0,
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
      769.0,
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
      443.0,
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
      491.0,
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
      539.0,
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
      588.0,
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
      588.0,
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
      813.0,
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
      813.0,
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
     "id": "obj-181",
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      1910.0,
      600.0,
      78.0,
      18.0
     ],
     "outlettype": [
      "",
      ""
     ],
     "text": "Quant",
     "presentation": 1,
     "presentation_rect": [
      813.0,
      136.0,
      78.0,
      18.0
     ],
     "mode": 1,
     "texton": "Quant ✓",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Input Quantize",
       "parameter_shortname": "Quant",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Quantize"
    }
   },
   {
    "box": {
     "id": "obj-182",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      1910.0,
      630.0,
      100.0,
      22.0
     ],
     "text": "prepend quantize"
    }
   },
   {
    "box": {
     "id": "obj-183",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "bang"
     ],
     "patching_rect": [
      2020.0,
      600.0,
      170.0,
      22.0
     ],
     "text": "metro 16n @quantize 16n @active 1"
    }
   },
   {
    "box": {
     "id": "obj-184",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      2020.0,
      630.0,
      35.0,
      22.0
     ],
     "text": "tick"
    }
   },
   {
    "box": {
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      40.0,
      620.0,
      150.0,
      33.0
     ],
     "text": "-",
     "fontsize": 24.0,
     "presentation": 1,
     "presentation_rect": [
      5.0,
      3.0,
      160.0,
      33.0
     ],
     "varname": "shownr",
     "id": "obj-185"
    }
   },
   {
    "box": {
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "patching_rect": [
      40.0,
      660.0,
      160.0,
      30.0
     ],
     "text": "keine Bank",
     "presentation": 1,
     "presentation_rect": [
      5.0,
      36.0,
      160.0,
      30.0
     ],
     "varname": "showname",
     "id": "obj-186"
    }
   },
   {
    "box": {
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      560.0,
      89.0,
      22.0
     ],
     "text": "prepend set",
     "outlettype": [
      ""
     ],
     "id": "obj-187"
    }
   },
   {
    "box": {
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      140.0,
      590.0,
      89.0,
      22.0
     ],
     "text": "prepend set",
     "outlettype": [
      ""
     ],
     "id": "obj-188"
    }
   },
   {
    "box": {
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      40.0,
      240.0,
      50.0,
      18.0
     ],
     "outlettype": [
      "",
      "float"
     ],
     "presentation": 1,
     "presentation_rect": [
      5.0,
      70.0,
      50.0,
      18.0
     ],
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Bank",
       "parameter_shortname": "Bank",
       "parameter_type": 1,
       "parameter_mmin": 1,
       "parameter_mmax": 128,
       "parameter_initial": [
        1
       ],
       "parameter_initial_enable": 1,
       "parameter_unitstyle": 0
      }
     },
     "parameter_enable": 1,
     "varname": "bank",
     "id": "obj-189"
    }
   },
   {
    "box": {
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      40.0,
      270.0,
      117.0,
      22.0
     ],
     "text": "prepend banknum",
     "outlettype": [
      ""
     ],
     "id": "obj-190"
    }
   },
   {
    "box": {
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      120.0,
      240.0,
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
      60.0,
      70.0,
      28.0,
      18.0
     ],
     "mode": 0,
     "texton": "◀",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Bank Prev",
       "parameter_shortname": "Bank Prev",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Bank Prev",
     "id": "obj-191"
    }
   },
   {
    "box": {
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      120.0,
      270.0,
      40.0,
      22.0
     ],
     "text": "t b",
     "outlettype": [
      "bang"
     ],
     "id": "obj-192"
    }
   },
   {
    "box": {
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      120.0,
      300.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "bankprev",
     "id": "obj-193"
    }
   },
   {
    "box": {
     "maxclass": "live.text",
     "numinlets": 1,
     "numoutlets": 2,
     "patching_rect": [
      210.0,
      240.0,
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
      90.0,
      70.0,
      28.0,
      18.0
     ],
     "mode": 0,
     "texton": "▶",
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Bank Next",
       "parameter_shortname": "Bank Next",
       "parameter_type": 2,
       "parameter_enum": [
        "off",
        "on"
       ],
       "parameter_mmax": 1
      }
     },
     "parameter_enable": 1,
     "varname": "Bank Next",
     "id": "obj-194"
    }
   },
   {
    "box": {
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "patching_rect": [
      210.0,
      270.0,
      40.0,
      22.0
     ],
     "text": "t b",
     "outlettype": [
      "bang"
     ],
     "id": "obj-195"
    }
   },
   {
    "box": {
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "patching_rect": [
      210.0,
      300.0,
      70.0,
      22.0
     ],
     "outlettype": [
      ""
     ],
     "text": "banknext",
     "id": "obj-196"
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
      378.0,
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
      3
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
      4
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
      6
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
      5
     ],
     "destination": [
      "obj-180",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-181",
      0
     ],
     "destination": [
      "obj-182",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-182",
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
      "obj-183",
      0
     ],
     "destination": [
      "obj-184",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-184",
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
      "obj-2",
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
      4
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
      "obj-121",
      0
     ],
     "destination": [
      "obj-187",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-187",
      0
     ],
     "destination": [
      "obj-185",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-121",
      1
     ],
     "destination": [
      "obj-188",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-188",
      0
     ],
     "destination": [
      "obj-186",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-189",
      0
     ],
     "destination": [
      "obj-190",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-190",
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
      "obj-191",
      0
     ],
     "destination": [
      "obj-192",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-192",
      0
     ],
     "destination": [
      "obj-193",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-193",
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
      "obj-194",
      0
     ],
     "destination": [
      "obj-195",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-195",
      0
     ],
     "destination": [
      "obj-196",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-196",
      0
     ],
     "destination": [
      "obj-1",
      0
     ]
    }
   }
  ],
  "devicewidth": 1024.0
 }
}