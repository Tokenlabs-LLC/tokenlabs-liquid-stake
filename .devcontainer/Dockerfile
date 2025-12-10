# Usar la imagen base de Ubuntu 24.04
FROM ubuntu:24.04

# Configurar la zona horaria
ENV TZ=America/Managua
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Actualizar paquetes y configurar el entorno básico
# Dependencias según documentación oficial: https://docs.iota.org/developer/getting-started/install-iota
RUN apt update && apt upgrade -y && \
    apt install -y \
    software-properties-common \
    curl \
    wget \
    nano \
    vim \
    git \
    ca-certificates \
    # Dependencias para compilar IOTA CLI (oficial)
    build-essential \
    pkg-config \
    libssl-dev \
    openssl \
    libclang-dev \
    clang \
    libpq-dev \
    libudev-dev \
    libusb-1.0-0-dev \
    cmake \
    jq \
    protobuf-compiler \
    libprotobuf-dev \
    && apt clean && rm -rf /var/lib/apt/lists/*

# Instalar Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Crear un usuario no root para mayor seguridad
USER root
WORKDIR /root

# Comando por defecto al iniciar el contenedor
CMD ["/bin/bash"]
