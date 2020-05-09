FROM centos:7

# install nagios from pkg manager
RUN yum clean expire-cache \
 && yum install -y epel-release \
 && yum install -y \
      nagios nagios-selinux nagios-plugins-all \
      perl-LWP-Protocol-https perl-Crypt-SSLeay perl-libwww-perl \
      vim python-requests nagios-plugins-nrpe \
 && yum clean all

# patch baseurl for direct hosting
RUN sed -Ei.bak "/cgi_base_url/s#='.+'#='/cgi-bin'#" \
      /usr/share/nagios/html/config.inc.php
