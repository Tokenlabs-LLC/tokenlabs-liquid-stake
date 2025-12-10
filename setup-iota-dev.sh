#!/bin/bash
# setup-iota-dev.sh - Script de setup automatico para IOTA CLI
# Uso: ./setup-iota-dev.sh [opciones]
#
# Opciones:
#   --rebuild    Forzar reconstruccion del contenedor
#   --shell      Solo entrar al contenedor (si existe)
#   --status     Mostrar estado del entorno
#   --help       Mostrar ayuda
#
# Comportamiento:
# - Primera vez: Construye imagen, crea contenedor, instala todo
# - Siguientes veces: Detecta que ya existe y entra directamente
# - El contenedor persiste entre sesiones (no se pierde)

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuracion
CONTAINER_NAME="iota-move-dev"
IMAGE_NAME="iota-move-dev"
SETUP_MARKER="/.iota-setup-complete"

# ============================================
# FUNCIONES DE UTILIDAD
# ============================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  IOTA Move Development Environment${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_help() {
    echo "Uso: ./setup-iota-dev.sh [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --rebuild    Forzar reconstruccion del contenedor (borra el anterior)"
    echo "  --shell      Solo entrar al contenedor existente"
    echo "  --status     Mostrar estado del entorno de desarrollo"
    echo "  --stop       Detener el contenedor"
    echo "  --help       Mostrar esta ayuda"
    echo ""
    echo "Sin opciones: Configura todo automaticamente y entra al contenedor"
    echo ""
    echo "El contenedor PERSISTE entre sesiones. No pierdes tu configuracion."
}

# Detectar si estamos dentro de un contenedor Docker
is_inside_container() {
    if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null || grep -q containerd /proc/1/cgroup 2>/dev/null; then
        return 0
    fi
    return 1
}

# Verificar si el setup ya esta completo (dentro del contenedor)
is_setup_complete() {
    [ -f "$SETUP_MARKER" ] && command -v iota &> /dev/null
}

# Obtener directorio del proyecto
get_project_dir() {
    cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

# ============================================
# MODO: DENTRO DEL CONTENEDOR
# ============================================
setup_inside_container() {
    echo -e "${GREEN}Detectado: Ejecutando DENTRO del contenedor${NC}"
    echo ""

    # Si ya esta todo instalado, solo mostrar info
    if is_setup_complete; then
        echo -e "${GREEN}El entorno ya esta completamente configurado!${NC}"
        echo ""
        show_environment_info
        return 0
    fi

    # 1. Instalar Rust si no esta instalado
    echo -e "${YELLOW}[1/5] Verificando Rust...${NC}"
    if ! command -v rustc &> /dev/null; then
        if [ -f "$HOME/.cargo/env" ]; then
            source "$HOME/.cargo/env"
        fi
    fi

    if ! command -v rustc &> /dev/null; then
        echo -e "${YELLOW}Instalando Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        echo -e "${GREEN}Rust instalado${NC}"
    else
        source "$HOME/.cargo/env" 2>/dev/null || true
        echo -e "${GREEN}Rust ya instalado: $(rustc --version)${NC}"
    fi

    # 2. Instalar dependencias de compilacion
    echo -e "${YELLOW}[2/5] Verificando dependencias de compilacion...${NC}"
    if ! command -v cmake &> /dev/null || ! command -v clang &> /dev/null; then
        echo -e "${YELLOW}Instalando dependencias oficiales de IOTA...${NC}"
        apt update && apt install -y \
            ca-certificates \
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
            git
        echo -e "${GREEN}Dependencias instaladas${NC}"
    else
        echo -e "${GREEN}Dependencias ya instaladas${NC}"
    fi

    # 3. Instalar IOTA CLI si no esta instalado
    echo -e "${YELLOW}[3/5] Verificando IOTA CLI...${NC}"
    if ! command -v iota &> /dev/null; then
        echo -e "${YELLOW}Instalando IOTA CLI desde mainnet branch...${NC}"
        echo -e "${YELLOW}Esto puede tardar 10-20 minutos. Por favor espera...${NC}"
        echo ""
        cargo install --locked --git https://github.com/iotaledger/iota.git --branch mainnet iota
        echo -e "${GREEN}IOTA CLI instalado${NC}"
    else
        echo -e "${GREEN}IOTA CLI ya instalado: $(iota --version 2>/dev/null)${NC}"
    fi

    # 4. Configurar .bashrc
    echo -e "${YELLOW}[4/5] Configurando shell...${NC}"
    BASHRC="$HOME/.bashrc"

    # Agregar cargo al PATH
    if ! grep -q 'source.*cargo/env' "$BASHRC" 2>/dev/null; then
        echo '' >> "$BASHRC"
        echo '# IOTA Development Environment' >> "$BASHRC"
        echo 'source "$HOME/.cargo/env" 2>/dev/null || true' >> "$BASHRC"
        echo -e "${GREEN}Cargo agregado a .bashrc${NC}"
    fi

    # Agregar alias utiles
    if ! grep -q 'alias iota-test' "$BASHRC" 2>/dev/null; then
        echo '' >> "$BASHRC"
        echo '# IOTA Aliases' >> "$BASHRC"
        echo 'alias iota-test="iota move test"' >> "$BASHRC"
        echo 'alias iota-build="iota move build"' >> "$BASHRC"
        echo 'alias iota-publish="iota client publish --gas-budget 100000000"' >> "$BASHRC"
        echo -e "${GREEN}Aliases agregados${NC}"
    fi

    # 5. Marcar setup como completo
    echo -e "${YELLOW}[5/5] Finalizando setup...${NC}"
    touch "$SETUP_MARKER"
    echo -e "${GREEN}Setup marcado como completo${NC}"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Setup completado exitosamente!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    show_post_install_instructions

    # Recargar bashrc
    source "$BASHRC" 2>/dev/null || true
}

show_environment_info() {
    echo -e "${CYAN}--- Estado del Entorno ---${NC}"
    echo -e "IOTA CLI:    $(iota --version 2>/dev/null || echo 'No instalado')"
    echo -e "Rust:        $(rustc --version 2>/dev/null || echo 'No instalado')"
    echo -e "Cargo:       $(cargo --version 2>/dev/null || echo 'No instalado')"
    echo ""

    # Mostrar entornos configurados
    if command -v iota &> /dev/null; then
        echo -e "${CYAN}--- Entornos IOTA Configurados ---${NC}"
        iota client envs 2>/dev/null || echo "No hay entornos configurados"
        echo ""

        echo -e "${CYAN}--- Wallet Activa ---${NC}"
        iota client active-address 2>/dev/null || echo "No hay wallet activa"
    fi
    echo ""
}

show_post_install_instructions() {
    echo -e "${CYAN}--- Proximos pasos ---${NC}"
    echo ""
    echo -e "1. Configurar entorno (primera vez):"
    echo -e "   ${BLUE}iota client envs${NC}"
    echo -e "   (Selecciona testnet o mainnet)"
    echo ""
    echo -e "2. Agregar mainnet manualmente:"
    echo -e "   ${BLUE}iota client new-env --alias mainnet --rpc https://api.mainnet.iota.cafe${NC}"
    echo ""
    echo -e "3. Importar wallet existente:"
    echo -e "   ${BLUE}iota keytool import \"tu-private-key\" ed25519${NC}"
    echo ""
    echo -e "4. O crear nueva wallet:"
    echo -e "   ${BLUE}iota client new-address ed25519${NC}"
    echo ""
    echo -e "5. Verificar balance:"
    echo -e "   ${BLUE}iota client gas${NC}"
    echo ""
    echo -e "${CYAN}--- Comandos utiles ---${NC}"
    echo -e "   ${BLUE}iota-build${NC}     Compilar proyecto"
    echo -e "   ${BLUE}iota-test${NC}      Ejecutar tests"
    echo -e "   ${BLUE}iota-publish${NC}   Publicar contrato"
    echo ""
}

# ============================================
# MODO: FUERA DEL CONTENEDOR (HOST)
# ============================================
setup_outside_container() {
    local FORCE_REBUILD=$1
    local SHELL_ONLY=$2

    PROJECT_DIR="$(get_project_dir)"

    echo -e "${GREEN}Detectado: Ejecutando desde el HOST${NC}"
    echo ""

    # 1. Verificar Docker
    echo -e "${YELLOW}[1/4] Verificando Docker...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no esta instalado${NC}"
        echo "Instala Docker desde: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}Docker OK${NC}"

    # 2. Verificar si el contenedor ya existe y esta listo
    CONTAINER_EXISTS=$(docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" && echo "yes" || echo "no")
    CONTAINER_RUNNING=$(docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" && echo "yes" || echo "no")

    # Si forzamos rebuild, eliminar contenedor existente
    if [ "$FORCE_REBUILD" = "yes" ]; then
        echo -e "${YELLOW}Forzando reconstruccion...${NC}"
        docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
        docker rmi -f "$IMAGE_NAME" 2>/dev/null || true
        CONTAINER_EXISTS="no"
        CONTAINER_RUNNING="no"
    fi

    # 3. Si el contenedor existe y tiene setup completo, entrar directamente
    if [ "$CONTAINER_EXISTS" = "yes" ]; then
        echo -e "${GREEN}Contenedor '$CONTAINER_NAME' encontrado${NC}"

        # Iniciar si no esta corriendo
        if [ "$CONTAINER_RUNNING" = "no" ]; then
            echo -e "${YELLOW}Iniciando contenedor...${NC}"
            docker start "$CONTAINER_NAME"
        fi

        # Verificar si el setup esta completo
        SETUP_DONE=$(docker exec "$CONTAINER_NAME" test -f "$SETUP_MARKER" 2>/dev/null && echo "yes" || echo "no")
        IOTA_INSTALLED=$(docker exec "$CONTAINER_NAME" which iota 2>/dev/null && echo "yes" || echo "no")

        if [ "$SETUP_DONE" = "yes" ] && [ -n "$IOTA_INSTALLED" ]; then
            echo -e "${GREEN}Entorno ya configurado completamente!${NC}"
            echo ""
            echo -e "${CYAN}Entrando al contenedor...${NC}"
            echo -e "${CYAN}(Escribe 'exit' para salir)${NC}"
            echo ""
            docker exec -it "$CONTAINER_NAME" bash
            return 0
        else
            echo -e "${YELLOW}El contenedor existe pero el setup no esta completo${NC}"
            echo -e "${YELLOW}Continuando con la instalacion...${NC}"
        fi
    fi

    # 4. Construir imagen si no existe
    echo -e "${YELLOW}[2/4] Verificando imagen Docker...${NC}"
    if ! docker image inspect "$IMAGE_NAME" &> /dev/null; then
        echo -e "${YELLOW}Construyendo imagen $IMAGE_NAME...${NC}"

        # Verificar que existe el Dockerfile
        if [ ! -f "$PROJECT_DIR/.devcontainer/Dockerfile" ]; then
            echo -e "${RED}Error: No se encuentra .devcontainer/Dockerfile${NC}"
            echo "Creando Dockerfile basico..."
            mkdir -p "$PROJECT_DIR/.devcontainer"
            cat > "$PROJECT_DIR/.devcontainer/Dockerfile" << 'EOF'
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/iotaMoveContrats
EOF
        fi

        docker build -t "$IMAGE_NAME" -f "$PROJECT_DIR/.devcontainer/Dockerfile" "$PROJECT_DIR"
        echo -e "${GREEN}Imagen construida${NC}"
    else
        echo -e "${GREEN}Imagen $IMAGE_NAME ya existe${NC}"
    fi

    # 5. Crear y arrancar contenedor
    echo -e "${YELLOW}[3/4] Creando contenedor...${NC}"
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

    docker run -d \
        --name "$CONTAINER_NAME" \
        -v "$PROJECT_DIR:/workspaces/iotaMoveContrats" \
        -w /workspaces/iotaMoveContrats \
        --restart unless-stopped \
        "$IMAGE_NAME" \
        tail -f /dev/null

    echo -e "${GREEN}Contenedor creado y ejecutandose${NC}"

    # 6. Ejecutar setup dentro del contenedor
    echo -e "${YELLOW}[4/4] Ejecutando setup dentro del contenedor...${NC}"
    echo ""

    if [ "$SHELL_ONLY" = "yes" ]; then
        echo -e "${CYAN}Entrando al contenedor (modo shell)...${NC}"
        docker exec -it "$CONTAINER_NAME" bash
    else
        echo -e "${CYAN}Instalando dependencias e IOTA CLI...${NC}"
        echo -e "${CYAN}(Esto puede tardar 15-25 minutos la primera vez)${NC}"
        echo ""
        docker exec -it "$CONTAINER_NAME" bash -c "./setup-iota-dev.sh && bash"
    fi
}

show_status() {
    print_header

    if is_inside_container; then
        echo -e "${GREEN}Ubicacion: DENTRO del contenedor${NC}"
        echo ""
        show_environment_info
    else
        echo -e "${GREEN}Ubicacion: HOST (fuera del contenedor)${NC}"
        echo ""

        # Estado del contenedor
        CONTAINER_EXISTS=$(docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" && echo "yes" || echo "no")
        CONTAINER_RUNNING=$(docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" && echo "yes" || echo "no")

        echo -e "${CYAN}--- Estado del Contenedor ---${NC}"
        echo -e "Contenedor:  $CONTAINER_NAME"

        if [ "$CONTAINER_EXISTS" = "yes" ]; then
            if [ "$CONTAINER_RUNNING" = "yes" ]; then
                echo -e "Estado:      ${GREEN}Ejecutandose${NC}"

                # Verificar setup
                SETUP_DONE=$(docker exec "$CONTAINER_NAME" test -f "$SETUP_MARKER" 2>/dev/null && echo "yes" || echo "no")
                IOTA_VERSION=$(docker exec "$CONTAINER_NAME" iota --version 2>/dev/null || echo "No instalado")

                echo -e "Setup:       $([ "$SETUP_DONE" = "yes" ] && echo "${GREEN}Completo${NC}" || echo "${YELLOW}Incompleto${NC}")"
                echo -e "IOTA CLI:    $IOTA_VERSION"
            else
                echo -e "Estado:      ${YELLOW}Detenido${NC}"
            fi
        else
            echo -e "Estado:      ${RED}No existe${NC}"
        fi

        echo ""
        echo -e "${CYAN}--- Comandos disponibles ---${NC}"
        echo -e "  ${BLUE}./setup-iota-dev.sh${NC}           Entrar al entorno"
        echo -e "  ${BLUE}./setup-iota-dev.sh --rebuild${NC} Reconstruir desde cero"
        echo -e "  ${BLUE}./setup-iota-dev.sh --stop${NC}    Detener contenedor"
    fi
}

stop_container() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Deteniendo contenedor $CONTAINER_NAME...${NC}"
        docker stop "$CONTAINER_NAME"
        echo -e "${GREEN}Contenedor detenido${NC}"
        echo ""
        echo -e "Para volver a iniciar: ${BLUE}./setup-iota-dev.sh${NC}"
    else
        echo -e "${YELLOW}El contenedor no esta ejecutandose${NC}"
    fi
}

# ============================================
# MAIN: Parsear argumentos y ejecutar
# ============================================
print_header

FORCE_REBUILD="no"
SHELL_ONLY="no"

case "$1" in
    --help|-h)
        print_help
        exit 0
        ;;
    --rebuild)
        FORCE_REBUILD="yes"
        ;;
    --shell)
        SHELL_ONLY="yes"
        ;;
    --status)
        show_status
        exit 0
        ;;
    --stop)
        stop_container
        exit 0
        ;;
esac

if is_inside_container; then
    setup_inside_container
else
    setup_outside_container "$FORCE_REBUILD" "$SHELL_ONLY"
fi
