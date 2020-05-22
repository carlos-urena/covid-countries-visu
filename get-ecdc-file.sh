# gets the ECDC raw file to 'ecdc-raw'.csv'
#!/bin/bash

rm  -f ecdc-raw.csv
curl https://opendata.ecdc.europa.eu/covid19/casedistribution/csv/ >ecdc-raw.csv
# awk -F , '{ if (length($3) == 1 ) month=0$3 ; else month=$3 ; if (length($2) == 1 ) day=0$2 ; else day=$2 ; print $4,month,day, $5, $6, $10, $9 ; }' ecdc-raw.csv | sort >data2.txt
# tr -d '\r' <data2.txt >data3.txt
# grep ESP data3.txt >data-ESP.txt
# grep USA data3.txt >data-USA.txt
# grep ITA data3.txt >data-ITA.txt
# more data-ESP.txt
