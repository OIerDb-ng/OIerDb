#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import math
import os
import re
import requests
from urllib.parse import quote

__headers__ = {
    "Connection": "close",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}
__re_title__ = re.compile(r"<title>([^<]*)_百度百科</title>")
__re_norm__ = re.compile(r"\[([^(]*)\([^)]*\)\|\w+\|[^\]]*\]\[([^(]*)\([^)]*\)\|\w+\|[^\]]*\]")
__re_baike__ = re.compile(r"<em>([^<]*)</em> - 百度百科")


def get_kleck():
    return ""


def get_redirect(entry):
    import sys

    # print('REQUEST =', entry, file=sys.stderr)
    res = requests.get("https://baike.baidu.com/item/" + entry, headers=__headers__)
    res.encoding = "utf8"
    if match := re.search(__re_title__, res.text):
        return match.group(1)
    else:
        # print('REQUEST2 =', entry, file=sys.stderr)
        res = requests.get(
            "http://www.baidu.com/s?wd=" + entry, headers=__headers__, cookies={"kleck": get_kleck()}
        )
        res.encoding = "utf8"
        # print('RES TEXT =', res.text)
        if match := re.search(__re_baike__, res.text):
            return match.group(1)
    return None


def __normalize__(address_norm):
    if match := re.match(__re_norm__, address_norm):
        return match.group(1), match.group(2)
    else:
        return None


def get_location(entry, province=""):
    try:
        res = requests.get("https://map.baidu.com/?qt=s&wd=" + entry)
        res.encoding = "utf8"
        locs = res.json()
        for loc in locs["content"]:
            ret = __normalize__(loc["address_norm"])
            if ret is not None and ret[0].startswith(province):
                return ret
        return None
    except Exception:
        return None


def get_longlat(location):
    return get_longlat_google(location)


BAIDU_API_KEY = os.environ.get("BAIDU_MAP_API_KEY")


def get_longlat_baidu(location):
    res = requests.get(
        f"https://api.map.baidu.com/geocoder?output=json&address={location}&ak={BAIDU_API_KEY}"
    )
    res.encoding = "utf8"
    try:
        loc = res.json()["result"]["location"]
        return loc["lng"], loc["lat"]
    except Exception:
        return math.nan, math.nan


GOOGLE_API_KEY = os.environ.get("GOOGLE_MAP_API_KEY")


def get_longlat_google(location):
    while True:
        try:
            res = requests.get(
                f"https://maps.googleapis.com/maps/api/geocode/json?address={quote(location)}&key={GOOGLE_API_KEY}"
            )
        except Exception:
            continue
        res.encoding = "utf8"
        try:
            loc = res.json()["results"][0]["geometry"]["location"]
            print(" ->", loc)
            return loc["lng"], loc["lat"]
        except Exception:
            print()
            return math.nan, math.nan
