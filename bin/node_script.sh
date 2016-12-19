#!/bin/bash
#/*/---------------------------------------------------------/*/
#/*/ Craydent LLC proxy-v1.1.2                               /*/
#/*/ Copyright 2011 (http://craydent.com/about)              /*/
#/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
#/*/ (http://craydent.com/license)                           /*/
#/*/---------------------------------------------------------/*/
#/*/---------------------------------------------------------/*/

# $1=>project name
# $2=>list of servers to run
# $3=>node root folder/server file path (absolute node path)
# $4=>do not start

#sudo mkdir -p /var/craydent/nodejs/$1;
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
echo "before kill proxy $2 $3 $4 \"$list\"";
ps aux | egrep "$list".*;
ps aux | egrep "node\s$nodepath($list)$".*|awk '{print $2}' | xargs kill -9
echo "$4 parameter4";
echo "after kill $nodepath $2 $3 $4";
if [ -z "$4" ]; then
    logBasePath="/var/craydent/log/$projpath";
    mkdir -p "$logBasePath/archive";

    for i in "${process_list[@]}"; do
        cp $logBasePath/$i.log "$logBasePath/archive/$i.log.$(date +%F_%R)";
        nohup node $nodepath$i > "$logBasePath/$i.log" 2>&1 &
    done

    ps aux | egrep "$list".*;
fi

exit