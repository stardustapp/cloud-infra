# based on https://docs.docker.com/engine/examples/running_ssh_service/
FROM ubuntu:18.04

# don't leave host keys on the instance
RUN apt-get update \
 && apt-get install -y openssh-server git vim \
 && rm /etc/ssh/ssh_host_* \
 && rm -rf /var/lib/apt/lists/*

# echo 'root:whatever' | chpasswd
RUN mkdir /var/run/sshd \
 && sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config \
 && sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd

#ENV NOTVISIBLE "in users profile"
#RUN echo "export VISIBLE=now" >> /etc/profile

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
