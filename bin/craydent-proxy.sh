#!/bin/bash
# Craydent LLC
# Copyright 2011 
# Dual licensed under the MIT or GPL Version 2 licenses.
#
# Author: Clark Inada

# $1=>path to node root folder for proxy
cd $1;
process_list=(
    index.js
)
list=$(echo ${process_list[@]}|tr " " "|")
sudo ps aux|egrep "$list".*|awk '{print $2}'|xargs kill -9

logBasePath="/var/craydentdeploy/log/proxy";
sudo mkdir -p "$logBasePath/archive";

for i in "${process_list[@]}"; do
    cp $logBasePath/$i.log "$logBasePath/archive/$i.log.$(date +%F_%R)";
    nohup node index.js > "$logBasePath/$i.log" 2>&1 &
done

ps aux|egrep "$list".*