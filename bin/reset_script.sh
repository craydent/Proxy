#!/bin/bash
#/*/---------------------------------------------------------/*/
#/*/ Craydent LLC proxy-v0.1.25                              /*/
#/*/ Copyright 2011 (http://craydent.com/about)              /*/
#/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
#/*/ (http://craydent.com/license)                           /*/
#/*/---------------------------------------------------------/*/
#/*/---------------------------------------------------------/*/

# $1=>project name
# $2=>list of servers to run
# $3=>node root folder/server file path (absolute node path)

#cd /var/craydent/nodejs/$1;
projpath=$1
nodepath=$3
if [ -z "$3" ]; then
    nodepath="$nodepath/";
fi
LEN=${#nodepath}-1
if [ "${nodepath:LEN}" != "/" ]; then
  nodepath=$nodepath"/"
fi
process_list=(${2});
list=$(echo ${process_list[@]}|tr " " "|")
#kill node processes in process_list
echo "terminating process proxy";
ps aux | egrep "node\s$nodepath($list)$".*|awk '{print $2}' | xargs kill -9

rm -r "/var/craydent/config/$projpath";
rm -r "/var/craydent/log/$projpath";
find /var/craydent -type d -empty -delete;

exit