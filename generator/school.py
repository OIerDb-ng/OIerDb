#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import api
import math
import util


class School:
    __all_school_list__ = []
    __school_name_map__ = {}
    __school_name_map_by_province__ = {}
    __schools_by_pc__ = {}

    def __init__(self, idx, name, province, city, aliases):
        self.id = idx
        self.name = name
        self.province = province
        self.city = city
        self.aliases = aliases
        self.score = util.D(0)

    @staticmethod
    def create(name, province, city, aliases):
        """新建学校。

        name: 正式名称。
        province: 省份。
        city: 城市（或区）。
        aliases: 别名列表（可以为空）。
        """

        idx = School.count_all()
        school = School(idx, name, province, city, aliases)
        School.__all_school_list__.append(school)
        School.__school_name_map__[name] = school
        for alias in aliases:
            School.__school_name_map__[alias] = school
        
        # 按省份存储学校名称映射
        if province not in School.__school_name_map_by_province__:
            School.__school_name_map_by_province__[province] = {}
        if name != "" and name in School.__school_name_map_by_province__[province]:
            print(f"\x1b[01mschool.txt: \x1b[031mwarning: \x1b[0;37m学校 '{name}' 在省份 '{province}' 内重复定义\x1b[0m")
        School.__school_name_map_by_province__[province][name] = school
        for alias in aliases:
            if alias != "" and alias in School.__school_name_map_by_province__[province]:
                print(f"\x1b[01mschool.txt: \x1b[031mwarning: \x1b[0;37m学校别名 '{alias}' 在省份 '{province}' 内重复定义\x1b[0m")
            School.__school_name_map_by_province__[province][alias] = school
        
        pc_key = (province, city)
        if pc_key not in School.__schools_by_pc__:
            School.__schools_by_pc__[pc_key] = []
        if school in School.__schools_by_pc__[pc_key]:
            print(f"\x1b[01mschool.txt: \x1b[031mwarning: \x1b[0;37m学校 '{name}' 在全局范围内重复定义\x1b[0m")
        School.__schools_by_pc__[pc_key].append(school)
        return school

    @staticmethod
    def by_name(name):
        """根据名称返回学校。

        name: 学校名称。
        """

        if name in School.__school_name_map__:
            return School.__school_name_map__[name]
        raise ValueError(f"未知的学校名：\x1b[32m'{name}'\x1b[0m")

    @staticmethod
    def by_name_in_province(name, province):
        """根据名称和省份返回学校。

        name: 学校名称。
        province: 省份。
        """

        # 首先尝试在指定省份内查找
        if province in School.__school_name_map_by_province__:
            province_map = School.__school_name_map_by_province__[province]
            if name in province_map:
                return province_map[name]

        raise ValueError(f"未知的学校名：\x1b[32m'{name}'\x1b[0m（省份：{province}）")

    @staticmethod
    def find_candidate(name, province):
        """根据名称返回已有学校中最有可能者。

        name: 学校名称。
        province: 省份。
        """

        if name in School.__school_name_map__:
            return School.__school_name_map__[name]
        
        # 检测是否为 名称/机构 的形式（湖南的报名信息采用此形式）
        if "/" in name:
            name, _ = name.split("/", 1)
            if name in School.__school_name_map__:
                return School.__school_name_map__[name]

        redirect = api.get_redirect(name)
        if redirect is not None and redirect in School.__school_name_map__:
            return "b", School.__school_name_map__[redirect]
        ret = api.get_location(name, province)
        x, y = api.get_longlat(name)
        city = "未分区" if ret is None else ret[1]
        li = [
            (util.lcs(school.name, name), school)
            for school in School.__schools_by_pc__.get((province, city), [])
        ]
        li.sort(key=lambda pair: -pair[0])
        li = li[:3]
        for _, school in li:
            if not hasattr(school, "baike_cache"):
                school.baike_cache = api.get_redirect(school.name)
                school.x, school.y = api.get_longlat(school.name)
            if redirect is not None:
                if school.baike_cache == redirect:
                    if redirect == name:
                        return "f", school
                    else:
                        return "fs", school, redirect
        for _, school in li:
            dist = math.hypot(x - school.x, y - school.y)
            if dist <= 0.00108:  # 120 米
                return "b", school
        return "c", city

    @staticmethod
    def count_all():
        "获取当前学校总数。"

        return len(School.__all_school_list__)

    @staticmethod
    def get_all():
        "获取当前所有学校的列表。"

        return School.__all_school_list__

    def location(self):
        "获取位置，格式为 province,city。"

        return self.province + "," + self.city
